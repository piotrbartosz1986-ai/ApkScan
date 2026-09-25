package com.bricolab.scannerbridge;

import com.google.mlkit.vision.barcode.common.Barcode;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class ScannerConfig {

    public static volatile float liveRoiLeft = 0.07f;
    public static volatile float liveRoiRight = 0.93f;
    public static volatile float liveRoiTop = 0.20f;
    public static volatile float liveRoiBottom = 0.80f;

    public int version = 8;
    public long duplicateDelayMs = 1500L;
    public long releaseDelayMs = 550L;
    public long focusIntervalMs = 1800L;
    public boolean autoFocus = true;

    public int validConfirmReads = 3;
    public long validResetMs = 700L;
    public int invalidConfirmReads = 3;
    public long invalidResetMs = 700L;

    public boolean validateEanChecksum = true;
    public boolean padNumericTo13 = true;
    public float extraDigitalZoomMax = 3.0f;
    public boolean contextPreview = true;

    public float roiLeft = 0.07f;
    public float roiRight = 0.93f;
    public float roiTop = 0.20f;
    public float roiBottom = 0.80f;

    public final List<String> formats = new ArrayList<>();

    public ScannerConfig() {
        formats.add("EAN_13");
        formats.add("EAN_8");
        formats.add("CODE_128");
    }

    public static ScannerConfig fromJson(String json) {
        ScannerConfig config = new ScannerConfig();

        try {
            JSONObject root = new JSONObject(json);

            config.version = root.optInt("version", config.version);
            config.duplicateDelayMs = clampLong(root.optLong("duplicateDelayMs", config.duplicateDelayMs), 0L, 30000L);
            config.releaseDelayMs = clampLong(root.optLong("releaseDelayMs", config.releaseDelayMs), 0L, 10000L);
            config.focusIntervalMs = clampLong(root.optLong("focusIntervalMs", config.focusIntervalMs), 500L, 30000L);
            config.autoFocus = root.optBoolean("autoFocus", config.autoFocus);

            config.validConfirmReads = (int) clampLong(root.optInt("validConfirmReads", config.validConfirmReads), 1L, 10L);
            config.validResetMs = clampLong(root.optLong("validResetMs", config.validResetMs), 150L, 5000L);
            config.invalidConfirmReads = (int) clampLong(root.optInt("invalidConfirmReads", config.invalidConfirmReads), 1L, 10L);
            config.invalidResetMs = clampLong(root.optLong("invalidResetMs", config.invalidResetMs), 200L, 5000L);

            config.validateEanChecksum = root.optBoolean("validateEanChecksum", config.validateEanChecksum);
            config.padNumericTo13 = root.optBoolean("padNumericTo13", config.padNumericTo13);
            config.extraDigitalZoomMax = clampFloat((float) root.optDouble("extraDigitalZoomMax", config.extraDigitalZoomMax), 1f, 5f);
            config.contextPreview = root.optBoolean("contextPreview", config.contextPreview);

            JSONObject roi = root.optJSONObject("roi");
            if (roi != null) {
                config.roiLeft = clampFloat((float) roi.optDouble("left", config.roiLeft), 0f, 0.95f);
                config.roiRight = clampFloat((float) roi.optDouble("right", config.roiRight), 0.05f, 1f);
                config.roiTop = clampFloat((float) roi.optDouble("top", config.roiTop), 0f, 0.95f);
                config.roiBottom = clampFloat((float) roi.optDouble("bottom", config.roiBottom), 0.05f, 1f);
            }

            if (config.roiRight <= config.roiLeft) {
                config.roiLeft = 0.07f;
                config.roiRight = 0.93f;
            }
            if (config.roiBottom <= config.roiTop) {
                config.roiTop = 0.20f;
                config.roiBottom = 0.80f;
            }

            JSONArray array = root.optJSONArray("formats");
            if (array != null && array.length() > 0) {
                config.formats.clear();
                for (int i = 0; i < array.length(); i++) {
                    String value = array.optString(i, "").trim();
                    if (toBarcodeFormat(value) != Barcode.FORMAT_UNKNOWN && !config.formats.contains(value)) {
                        config.formats.add(value);
                    }
                }
                if (config.formats.isEmpty()) {
                    config.formats.add("EAN_13");
                    config.formats.add("EAN_8");
                    config.formats.add("CODE_128");
                }
            }
        } catch (Exception ignored) {
        }

        publishRoi(config);
        return config;
    }

    private static void publishRoi(ScannerConfig config) {
        liveRoiLeft = config.roiLeft;
        liveRoiRight = config.roiRight;
        liveRoiTop = config.roiTop;
        liveRoiBottom = config.roiBottom;
        ScanOverlayView.applyGlobalRoi(config.roiLeft, config.roiTop, config.roiRight, config.roiBottom);
    }

    public String toJson() {
        try {
            JSONObject root = new JSONObject();
            root.put("version", version);
            root.put("duplicateDelayMs", duplicateDelayMs);
            root.put("releaseDelayMs", releaseDelayMs);
            root.put("focusIntervalMs", focusIntervalMs);
            root.put("autoFocus", autoFocus);
            root.put("validConfirmReads", validConfirmReads);
            root.put("validResetMs", validResetMs);
            root.put("invalidConfirmReads", invalidConfirmReads);
            root.put("invalidResetMs", invalidResetMs);
            root.put("validateEanChecksum", validateEanChecksum);
            root.put("padNumericTo13", padNumericTo13);
            root.put("extraDigitalZoomMax", extraDigitalZoomMax);
            root.put("contextPreview", contextPreview);

            JSONObject roi = new JSONObject();
            roi.put("left", roiLeft);
            roi.put("right", roiRight);
            roi.put("top", roiTop);
            roi.put("bottom", roiBottom);
            root.put("roi", roi);

            JSONArray formatArray = new JSONArray();
            for (String format : formats) formatArray.put(format);
            root.put("formats", formatArray);
            return root.toString();
        } catch (Exception ignored) {
            return "{}";
        }
    }

    public int[] barcodeFormats() {
        ArrayList<Integer> values = new ArrayList<>();
        for (String format : formats) {
            int value = toBarcodeFormat(format);
            if (value != Barcode.FORMAT_UNKNOWN && !values.contains(value)) values.add(value);
        }
        if (values.isEmpty()) {
            values.add(Barcode.FORMAT_EAN_13);
            values.add(Barcode.FORMAT_EAN_8);
            values.add(Barcode.FORMAT_CODE_128);
        }
        int[] output = new int[values.size()];
        for (int i = 0; i < values.size(); i++) output[i] = values.get(i);
        return output;
    }

    public static int toBarcodeFormat(String name) {
        switch (name) {
            case "EAN_13": return Barcode.FORMAT_EAN_13;
            case "EAN_8": return Barcode.FORMAT_EAN_8;
            case "CODE_128": return Barcode.FORMAT_CODE_128;
            case "CODE_39": return Barcode.FORMAT_CODE_39;
            case "CODE_93": return Barcode.FORMAT_CODE_93;
            case "CODABAR": return Barcode.FORMAT_CODABAR;
            case "ITF": return Barcode.FORMAT_ITF;
            case "UPC_A": return Barcode.FORMAT_UPC_A;
            case "UPC_E": return Barcode.FORMAT_UPC_E;
            case "QR_CODE": return Barcode.FORMAT_QR_CODE;
            case "DATA_MATRIX": return Barcode.FORMAT_DATA_MATRIX;
            case "PDF417": return Barcode.FORMAT_PDF417;
            case "AZTEC": return Barcode.FORMAT_AZTEC;
            default: return Barcode.FORMAT_UNKNOWN;
        }
    }

    private static long clampLong(long value, long min, long max) {
        return Math.max(min, Math.min(max, value));
    }

    private static float clampFloat(float value, float min, float max) {
        return Math.max(min, Math.min(max, value));
    }
}
