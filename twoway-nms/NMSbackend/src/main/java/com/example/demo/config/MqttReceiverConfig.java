package com.example.demo.config;

import com.example.demo.service.DevicePayloadDecoder;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.core.MessageProducer;
import org.springframework.integration.mqtt.core.DefaultMqttPahoClientFactory;
import org.springframework.integration.mqtt.core.MqttPahoClientFactory;
import org.springframework.integration.mqtt.inbound.MqttPahoMessageDrivenChannelAdapter;
import org.springframework.integration.mqtt.support.DefaultPahoMessageConverter;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageHandler;

import java.util.Base64;

@Configuration
public class MqttReceiverConfig {

    @Value("${mqtt.broker.url}")
    private String brokerUrl;

    @Value("${mqtt.client.id}")
    private String clientId;

    @Value("${mqtt.topic}")
    private String topic;

    @Value("${mqtt.username:}") // 若無設定則預設為空字串
    private String username;

    @Value("${mqtt.password:}") // 若無設定則預設為空字串
    private String password;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private DevicePayloadDecoder payloadDecoder;

    // 設定 MQTT 連線
    @Bean
    public MqttPahoClientFactory mqttClientFactory() {
        DefaultMqttPahoClientFactory factory = new DefaultMqttPahoClientFactory();
        MqttConnectOptions options = new MqttConnectOptions();
        options.setServerURIs(new String[] { brokerUrl });
        options.setCleanSession(true);
        options.setAutomaticReconnect(true);
        // System.out.println("準備連線的 MQTT 網址是: " + brokerUrl);
        // 如果 application.properties 有設定帳號密碼，則套用
        if (username != null && !username.isEmpty()) {
            options.setUserName(username);
        }
        if (password != null && !password.isEmpty()) {
            options.setPassword(password.toCharArray());
        }

        factory.setConnectionOptions(options);
        return factory;
    }

    // 建立訊息通道
    @Bean
    public MessageChannel mqttInputChannel() {
        return new DirectChannel();
    }

    // 設定接收器 Adapter  綁定 Topic 與 Channel
    @Bean
    public MessageProducer inbound() {
        MqttPahoMessageDrivenChannelAdapter adapter = new MqttPahoMessageDrivenChannelAdapter(clientId,
                mqttClientFactory(), topic);
        adapter.setCompletionTimeout(5000);
        adapter.setConverter(new DefaultPahoMessageConverter());
        adapter.setQos(1);
        adapter.setOutputChannel(mqttInputChannel());
        return adapter;
    }

    // 訊息處理邏輯：當收到 ChirpStack 資料時會觸發這裡
    @Bean
    @ServiceActivator(inputChannel = "mqttInputChannel")
    public MessageHandler handler() {
        return message -> {
            String payload = (String) message.getPayload();

            // 原封不動存起來的整包 JSON 字串
            String rawJsonPayload = (String) message.getPayload();

            String receivedTopic = (String) message.getHeaders().get("mqtt_receivedTopic");
            
            try {
                JsonNode rootNode = objectMapper.readTree(payload);

                if (rootNode.has("deviceInfo") && rootNode.get("deviceInfo").has("devEui")) {

                    JsonNode deviceInfo = rootNode.get("deviceInfo");

                    String devEui = rootNode.get("deviceInfo").get("devEui").asText();
                    String deviceName = rootNode.path("deviceInfo").path("deviceName").asText(null);

                    // 靜態屬性
                    String deviceProfileName = deviceInfo.path("deviceProfileName").asText(null);
                    String deviceClassEnabled = deviceInfo.path("deviceClassEnabled").asText(null);

                    // Frame Counter
                    Integer fCnt = rootNode.path("fCnt").asInt(0);

                    //  rxInfo
                    String gatewayId = null;
                    Integer rssi = null;
                    Double snr = null;
                    Double gwLat = null;
                    Double gwLon = null;

                    if (rootNode.has("rxInfo") && rootNode.get("rxInfo").isArray()
                            && rootNode.get("rxInfo").size() > 0) {
                        JsonNode firstRx = rootNode.get("rxInfo").get(0);
                        gatewayId = firstRx.path("gatewayId").asText(null);
                        if (firstRx.has("rssi"))
                            rssi = firstRx.get("rssi").asInt();
                        if (firstRx.has("snr"))
                            snr = firstRx.get("snr").asDouble();

                        // Gateway 座標
                        JsonNode locNode = firstRx.path("location");
                        if (!locNode.isMissingNode()) {
                            gwLat = locNode.path("latitude").asDouble(0.0);
                            gwLon = locNode.path("longitude").asDouble(0.0);
                        }
                    }

                    // txInfo 
                    Long frequency = null;
                    Integer spreadingFactor = null;
                    if (rootNode.has("txInfo")) {
                        JsonNode txInfo = rootNode.get("txInfo");
                        frequency = txInfo.path("frequency").asLong();
                        JsonNode loraNode = txInfo.path("modulation").path("lora");
                        if (!loraNode.isMissingNode()) {
                            spreadingFactor = loraNode.path("spreadingFactor").asInt();
                        }
                    }

                    if (rootNode.has("data") && !rootNode.get("data").isNull()) {
                        String base64Data = rootNode.get("data").asText();
                        byte[] payloadBytes = Base64.getDecoder().decode(base64Data);

                        System.out.printf(" 設備: %s | GW: %s | fCnt: %d | SF: %d%n", devEui, gatewayId, fCnt,
                                spreadingFactor);

                
                        payloadDecoder.decodeAndSave(
                                devEui, deviceName, deviceProfileName, deviceClassEnabled,
                                gatewayId, fCnt, frequency, spreadingFactor, rssi, snr, gwLat, gwLon,
                                payloadBytes, rawJsonPayload);
                    }
                }
            } catch (Exception e) {
                System.err.println(" 解析 JSON 或處理訊息時發生錯誤: " + e.getMessage());
            }
        };
    }
}