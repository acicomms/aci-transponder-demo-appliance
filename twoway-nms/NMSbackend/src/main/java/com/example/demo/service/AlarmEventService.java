package com.example.demo.service;

import com.example.demo.dto.AlarmEventDto;
import com.example.demo.model.AlarmEvent;
import com.example.demo.repository.AlarmEventRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AlarmEventService {

    @Autowired
    private AlarmEventRepository alarmEventRepository;

    private static final String STATUS_ACTIVE   = "ACTIVE";
    private static final String STATUS_CLEARED  = "CLEARED";
    private static final String SEVERITY_DEFAULT = "MAJOR";

    private static final Set<String> VALID_CATEGORIES =
            Set.of("TEMPERATURE", "VOLTAGE", "RIPPLE", "TCP", "UNIT_STATUS");

    /**
     * Decoder 跳變偵測呼叫. flag 是當下旗標 (1=Alarm, 0=Normal).
     */
    public void recordTransition(String devEui, String category, int flag, Double currentValue) {
        if (devEui == null || category == null) return;
        String cat = category.toUpperCase();
        if (!VALID_CATEGORIES.contains(cat)) return;

        Optional<AlarmEvent> activeOpt = alarmEventRepository
                .findFirstByDevEuiAndCategoryAndStatusOrderByStartTimeDesc(devEui, cat, STATUS_ACTIVE);

        boolean hasActive  = activeOpt.isPresent();
        boolean isAlarming = (flag == 1);

        if (!hasActive && isAlarming) {
            AlarmEvent ev = new AlarmEvent();
            ev.setDevEui(devEui);
            ev.setCategory(cat);
            ev.setSeverity(SEVERITY_DEFAULT);
            ev.setStatus(STATUS_ACTIVE);
            ev.setStartTime(LocalDateTime.now());
            ev.setTriggerValue(currentValue);
            alarmEventRepository.save(ev);
        } else if (hasActive && !isAlarming) {
            AlarmEvent ev = activeOpt.get();
            ev.setStatus(STATUS_CLEARED);
            ev.setEndTime(LocalDateTime.now());
            ev.setResolveValue(currentValue);
            alarmEventRepository.save(ev);
        }
    }

    /**
     * Controller 查詢
     */
    public Map<String, Object> queryAlarmEvents(
            List<String> devEuis,
            List<String> categories,
            List<String> statuses,
            LocalDateTime start,
            LocalDateTime end,
            String sortBy,
            String sortDir,
            Integer page,
            Integer pageSize,
            Boolean countOnly,
            LocalDateTime since
    ) {
        Map<String, Object> result = new LinkedHashMap<>();

        if (Boolean.TRUE.equals(countOnly)) {
            LocalDateTime sinceTs = (since != null) ? since : LocalDateTime.now().minusYears(1);
            long count = alarmEventRepository.countByStartTimeGreaterThanEqual(sinceTs);
            result.put("count", count);
            return result;
        }

        // 預設範圍 = 今天 00:00 ~ now
        LocalDateTime effStart = (start != null) ? start : LocalDateTime.now().with(LocalTime.MIN);
        LocalDateTime effEnd   = (end   != null) ? end   : LocalDateTime.now();

        // 範圍內 events
        List<AlarmEvent> rangeEvents = alarmEventRepository
                .findByStartTimeBetweenOrderByStartTimeDesc(effStart, effEnd);

        // union: 持續中的 ACTIVE event 即使 startTime < effStart 也納入
        // (條件: startTime <= effEnd 排除未來邊界; LinkedHashMap by id 去重)
        List<AlarmEvent> activeEvents = alarmEventRepository
                .findByStatusOrderByStartTimeDesc(STATUS_ACTIVE);

        LinkedHashMap<Long, AlarmEvent> dedup = new LinkedHashMap<>();
        for (AlarmEvent e : rangeEvents) {
            if (e.getId() != null) dedup.put(e.getId(), e);
        }
        for (AlarmEvent e : activeEvents) {
            if (e.getId() != null
                    && e.getStartTime() != null
                    && !e.getStartTime().isAfter(effEnd)) {
                dedup.putIfAbsent(e.getId(), e);
            }
        }
        List<AlarmEvent> all = new java.util.ArrayList<>(dedup.values());

        Set<String> devFilter    = (devEuis == null || devEuis.isEmpty()) ? null : new HashSet<>(devEuis);
        Set<String> catFilter    = normalizeCategories(categories);
        Set<String> statusFilter = normalizeStatuses(statuses);

        List<AlarmEvent> filtered = all.stream()
                .filter(e -> devFilter    == null || devFilter.contains(e.getDevEui()))
                .filter(e -> catFilter    == null || catFilter.contains(e.getCategory()))
                .filter(e -> statusFilter == null || statusFilter.contains(e.getStatus()))
                .collect(Collectors.toList());

        Comparator<AlarmEvent> cmp = buildComparator(sortBy);
        if ("asc".equalsIgnoreCase(sortDir)) {
            filtered.sort(cmp);
        } else {
            filtered.sort(cmp.reversed());
        }

        int totalCount = filtered.size();

        int p  = (page == null || page < 1) ? 1 : page;
        int ps = (pageSize == null || pageSize < 1) ? 50 : Math.min(pageSize, 500);
        int from = Math.min((p - 1) * ps, totalCount);
        int to   = Math.min(from + ps, totalCount);

        List<AlarmEventDto> events = filtered.subList(from, to).stream()
                .map(AlarmEventDto::from)
                .collect(Collectors.toList());

        result.put("events", events);
        result.put("totalCount", totalCount);
        result.put("page", p);
        result.put("pageSize", ps);
        return result;
    }

    /** temp/volt/ripple/tcp 簡寫正規化 */
    private Set<String> normalizeCategories(List<String> categories) {
        if (categories == null || categories.isEmpty()) return null;
        Set<String> out = new HashSet<>();
        for (String c : categories) {
            if (c == null) continue;
            String norm = c.trim().toUpperCase();
            switch (norm) {
                case "TEMP":   case "TEMPERATURE":   out.add("TEMPERATURE"); break;
                case "VOLT":   case "VOLTAGE":       out.add("VOLTAGE");     break;
                case "RIPPLE":                       out.add("RIPPLE");      break;
                case "TCP":                          out.add("TCP");         break;
                case "UNIT":   case "UNIT_STATUS":   out.add("UNIT_STATUS"); break;
                default: out.add(norm); // 容錯, 認不出的最終 filter 會過不到
            }
        }
        return out.isEmpty() ? null : out;
    }

    /** ALL = 不過濾 */
    private Set<String> normalizeStatuses(List<String> statuses) {
        if (statuses == null || statuses.isEmpty()) return null;
        Set<String> out = new HashSet<>();
        for (String s : statuses) {
            if (s == null) continue;
            String norm = s.trim().toUpperCase();
            if ("ALL".equals(norm)) return null;
            out.add(norm);
        }
        return out.isEmpty() ? null : out;
    }

    private Comparator<AlarmEvent> buildComparator(String sortBy) {
        String key = (sortBy == null) ? "startTime" : sortBy;
        switch (key) {
            case "devEui":
                return Comparator.comparing(AlarmEvent::getDevEui, Comparator.nullsLast(String::compareTo));
            case "category":
                return Comparator.comparing(AlarmEvent::getCategory, Comparator.nullsLast(String::compareTo));
            case "duration":
                return Comparator.comparingLong(this::computeDurationSeconds);
            case "startTime":
            default:
                return Comparator.comparing(AlarmEvent::getStartTime, Comparator.nullsLast(LocalDateTime::compareTo));
        }
    }

    private long computeDurationSeconds(AlarmEvent e) {
        if (e.getStartTime() == null) return 0L;
        LocalDateTime endRef = (e.getEndTime() != null) ? e.getEndTime() : LocalDateTime.now();
        return Duration.between(e.getStartTime(), endRef).getSeconds();
    }
}