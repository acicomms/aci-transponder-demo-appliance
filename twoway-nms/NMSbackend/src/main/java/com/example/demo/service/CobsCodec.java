package com.example.demo.service;

import java.util.Arrays;

public class CobsCodec {


    public static byte[] encode(byte[] input) {
        byte[] output = new byte[input.length + 2];
        int read_index = 0;
        int write_index = 1;
        int code_index = 0;
        int code = 1;

        while (read_index < input.length) {
            if (input[read_index] == 0) {
                output[code_index] = (byte) code;
                code = 1;
                code_index = write_index++;
                read_index++;
            } else {
                output[write_index++] = input[read_index++];
                code++;
                if (code == 0xFF) {
                    output[code_index] = (byte) code;
                    code = 1;
                    code_index = write_index++;
                }
            }
        }
        output[code_index] = (byte) code;

        //註解或刪除這行   LoRaWAN封包不需要結尾的 0x00 設備
        // output[write_index++] = 0x00; // 結尾補 0x00

        return Arrays.copyOf(output, write_index);
    }

    /**
     * COBS 解碼
     */
    public static byte[] decode(byte[] input) {
        int length = input.length;
        if (length > 0 && input[length - 1] == 0x00) length--; // 移除結尾的 0x00

        byte[] output = new byte[length];
        int read_index = 0;
        int write_index = 0;

        while (read_index < length) {
            int code = input[read_index++] & 0xFF;
            if (code == 0) break; // 遇到意外的 0x00 終止
            for (int i = 1; i < code; i++) {
                if (read_index >= length) break;
                output[write_index++] = input[read_index++];
            }
            if (code < 0xFF && read_index < length) {
                output[write_index++] = 0x00;
            }
        }
        return Arrays.copyOf(output, write_index);
    }
}