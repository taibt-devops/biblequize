package com.biblequiz.modules.adminai;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

@Service
public class AIGenerationService {

    private static final Logger log = LoggerFactory.getLogger(AIGenerationService.class);
    private static final String GEMINI_API_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s";

    @Value("${gemini.api-key:}")
    private String apiKey;

    @Value("${gemini.model:gemini-2.0-flash}")
    private String model;

    @Value("${anthropic.api-key:}")
    private String claudeApiKey;

    @Value("${anthropic.model:claude-haiku-4-5-20251001}")
    private String claudeModel;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();

    public Map<String, Object> listModels() {
        if (!isConfigured()) return Map.of("error", "API key not configured");
        try {
            String url = "https://generativelanguage.googleapis.com/v1beta/models?key=" + apiKey;
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .GET()
                    .timeout(Duration.ofSeconds(15))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            return objectMapper.readValue(response.body(), new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of("error", e.getMessage());
        }
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public boolean isClaudeConfigured() {
        return claudeApiKey != null && !claudeApiKey.isBlank();
    }

    public String getModel() {
        return model;
    }

    public String getClaudeModel() {
        return claudeModel;
    }

    public List<Map<String, Object>> generate(
            String book, int chapter, int verseStart, int verseEnd,
            String difficulty, String type, String language, int count,
            String scriptureText, String customPrompt) throws Exception {

        // Single request asking for all `count` questions to avoid Gemini rate limiting
        String prompt = buildPrompt(book, chapter, verseStart, verseEnd,
                difficulty, type, language, count, scriptureText, customPrompt);

        String requestJson = objectMapper.writeValueAsString(Map.of(
                "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt))))
        ));
        String url = String.format(GEMINI_API_URL, model, apiKey);

        log.info("[AI] Single Gemini request for {} questions: model={}, book={} {}:{}-{}",
                count, model, book, chapter, verseStart, verseEnd);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestJson))
                .timeout(Duration.ofSeconds(90))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            log.error("[AI] Request failed: status={}, body={}", response.statusCode(),
                    response.body().substring(0, Math.min(300, response.body().length())));
            return List.of();
        }

        String text = extractTextFromGeminiResponse(response.body()).strip();
        if (text.startsWith("```")) {
            text = text.replaceFirst("```(?:json)?\\s*", "").replaceAll("```\\s*$", "").strip();
        }

        List<Map<String, Object>> questions = objectMapper.readValue(
                extractJsonArray(text), new TypeReference<>() {});

        log.info("[AI] Generated {}/{} questions from single request", questions.size(), count);
        return questions;
    }

    /** Auto-select the best Claude model for the given difficulty. */
    private String selectModelForDifficulty(String difficulty) {
        return switch (difficulty) {
            case "hard"   -> "claude-sonnet-4-6";        // Sonnet 4.6 for hard questions
            case "medium" -> "claude-sonnet-4-6";        // Sonnet 4.6 for medium
            default       -> "claude-haiku-4-5-20251001"; // Haiku for easy (fast + cheap)
        };
    }

    /**
     * Generate questions using one or more Claude models simultaneously.
     * Pass modelIds=["auto"] or empty to auto-select model based on difficulty.
     * Each model generates `count` questions in parallel → results tagged with _generatedBy.
     * Total requests = modelIds.size × count, all fired concurrently.
     */
    public List<Map<String, Object>> generateWithClaude(
            String book, int chapter, int verseStart, int verseEnd,
            String difficulty, String type, String language, int count,
            String scriptureText, String customPrompt, List<String> modelIds) throws Exception {

        // Resolve "auto" and empty list to difficulty-based model
        List<String> effectiveModels;
        if (modelIds == null || modelIds.isEmpty() || modelIds.contains("auto")) {
            String autoModel = selectModelForDifficulty(difficulty);
            log.info("[AI][Claude] Auto-selected model={} for difficulty={}", autoModel, difficulty);
            effectiveModels = List.of(autoModel);
        } else {
            effectiveModels = modelIds;
        }

        String prompt = buildPrompt(book, chapter, verseStart, verseEnd,
                difficulty, type, language, 1, scriptureText, customPrompt);

        log.info("[AI][Claude] Launching {} models × {} questions = {} parallel requests, book={} {}:{}-{}",
                effectiveModels.size(), count, effectiveModels.size() * count,
                book, chapter, verseStart, verseEnd);

        List<CompletableFuture<Map<String, Object>>> futures = new ArrayList<>();

        for (String modelId : effectiveModels) {
            String requestJson = objectMapper.writeValueAsString(Map.of(
                    "model", modelId,
                    "max_tokens", 1024,
                    "messages", List.of(Map.of("role", "user", "content", prompt))
            ));

            for (int i = 0; i < count; i++) {
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create("https://api.anthropic.com/v1/messages"))
                        .header("Content-Type", "application/json")
                        .header("x-api-key", claudeApiKey)
                        .header("anthropic-version", "2023-06-01")
                        .POST(HttpRequest.BodyPublishers.ofString(requestJson))
                        .timeout(Duration.ofSeconds(60))
                        .build();

                final String finalModelId = modelId;
                final int idx = i;
                CompletableFuture<Map<String, Object>> future = httpClient
                        .sendAsync(request, HttpResponse.BodyHandlers.ofString())
                        .thenApply(response -> {
                            try {
                                if (response.statusCode() != 200) {
                                    log.error("[AI][Claude][{}] Request #{} failed: status={}", finalModelId, idx, response.statusCode());
                                    return null;
                                }
                                String text = extractTextFromClaudeResponse(response.body()).strip();
                                if (text.startsWith("```")) {
                                    text = text.replaceFirst("```(?:json)?\\s*", "").replaceAll("```\\s*$", "").strip();
                                }
                                List<Map<String, Object>> list = objectMapper.readValue(
                                        extractJsonArray(text), new TypeReference<>() {});
                                if (list.isEmpty()) return null;
                                // Tag with generating model
                                java.util.LinkedHashMap<String, Object> q = new java.util.LinkedHashMap<>(list.get(0));
                                q.put("_generatedBy", finalModelId);
                                log.debug("[AI][Claude][{}] Request #{} OK", finalModelId, idx);
                                return q;
                            } catch (Exception e) {
                                log.error("[AI][Claude][{}] Request #{} parse error: {}", finalModelId, idx, e.getMessage());
                                return null;
                            }
                        });
                futures.add(future);
            }
        }

        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

        List<Map<String, Object>> questions = futures.stream()
                .map(CompletableFuture::join)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        log.info("[AI][Claude] Generated {}/{} questions from {} models (parallel)",
                questions.size(), effectiveModels.size() * count, effectiveModels.size());
        return questions;
    }

    private String extractTextFromClaudeResponse(String body) throws Exception {
        Map<String, Object> responseBody = objectMapper.readValue(body, new TypeReference<>() {});
        if (!(responseBody.get("content") instanceof List<?> contentList) || contentList.isEmpty()) {
            throw new RuntimeException("Empty or missing 'content' in Claude API response");
        }
        if (!(contentList.get(0) instanceof Map<?, ?> block)
                || !"text".equals(block.get("type"))
                || !(block.get("text") instanceof String text)) {
            throw new RuntimeException("Invalid content block in Claude API response");
        }
        return text;
    }

    /**
     * Safely navigates the Gemini response structure with null/type checks
     * and detects blocked responses (finishReason != STOP).
     */
    private String extractTextFromGeminiResponse(String body) throws Exception {
        Map<String, Object> responseBody = objectMapper.readValue(body, new TypeReference<>() {});

        if (!(responseBody.get("candidates") instanceof List<?> candidatesList) || candidatesList.isEmpty()) {
            throw new RuntimeException("Empty or missing 'candidates' in Gemini API response");
        }

        if (!(candidatesList.get(0) instanceof Map<?, ?> candidateMap)) {
            throw new RuntimeException("Invalid candidate structure in Gemini API response");
        }

        // Check if Gemini blocked or truncated the response
        Object finishReason = candidateMap.get("finishReason");
        if (finishReason instanceof String reason && !"STOP".equals(reason) && !"MAX_TOKENS".equals(reason)) {
            throw new RuntimeException("Gemini API blocked response: finishReason=" + reason);
        }

        if (!(candidateMap.get("content") instanceof Map<?, ?> contentMap)) {
            throw new RuntimeException("Missing 'content' in Gemini API candidate");
        }

        if (!(contentMap.get("parts") instanceof List<?> partsList) || partsList.isEmpty()) {
            throw new RuntimeException("Empty 'parts' in Gemini API content");
        }

        if (!(partsList.get(0) instanceof Map<?, ?> partMap)
                || !(partMap.get("text") instanceof String text)) {
            throw new RuntimeException("Missing 'text' in Gemini API part");
        }

        return text;
    }

    /**
     * Extracts the outermost JSON array from text that may contain surrounding prose.
     * Uses bracket depth tracking so nested arrays inside question options are handled correctly.
     */
    private String extractJsonArray(String text) {
        int start = -1;
        int depth = 0;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c == '[') {
                if (depth == 0) start = i;
                depth++;
            } else if (c == ']') {
                depth--;
                if (depth == 0 && start != -1) {
                    return text.substring(start, i + 1);
                }
            }
        }
        log.error("[AI] No JSON array found in response: {}", text);
        throw new RuntimeException("AI response did not contain a valid JSON array");
    }

    private String buildPrompt(String book, int chapter, int verseStart, int verseEnd,
                                String difficulty, String type, String language, int count,
                                String scriptureText, String customPrompt) {
        boolean isVi = "vi".equals(language);
        String ref = book + " " + chapter + ":" + verseStart
                + (verseEnd != verseStart ? "-" + verseEnd : "");
        String langName = isVi ? "Vietnamese (Tiếng Việt)" : "English";

        String typeInstruction = switch (type) {
            case "true_false" -> isVi
                    ? "true_false: options phải là [\"Đúng\", \"Sai\"], correctAnswer là 0 (Đúng) hoặc 1 (Sai)"
                    : "true_false: options must be [\"True\", \"False\"], correctAnswer is 0 (True) or 1 (False)";
            case "fill_in_blank" -> isVi
                    ? "fill_in_blank: options là [], correctAnswer là 0, câu hỏi có ___ là chỗ điền"
                    : "fill_in_blank: options is [], correctAnswer is 0, question has ___ as the blank";
            case "multiple_choice_multi" -> isVi
                    ? "multiple_choice_multi: 4 options, correctAnswer là mảng các index đúng, VD [0,2]"
                    : "multiple_choice_multi: 4 options, correctAnswer is array of correct indices e.g. [0,2]";
            default -> isVi
                    ? "multiple_choice_single: 4 options (A,B,C,D), correctAnswer là index 0-3 của đáp án đúng"
                    : "multiple_choice_single: 4 options (A,B,C,D), correctAnswer is 0-based index of correct answer";
        };

        String difficultyNote = switch (difficulty) {
            case "hard"   -> isVi ? "đòi hỏi hiểu sâu, chi tiết cụ thể, bối cảnh lịch sử"
                                  : "deep understanding, specific details, historical context";
            case "medium" -> isVi ? "nội dung chính, nhân vật, sự kiện quan trọng"
                                  : "main content, key characters, important events";
            default       -> isVi ? "ý nghĩa cơ bản, nội dung rõ ràng trong đoạn"
                                  : "basic meaning, clear content in the passage";
        };

        StringBuilder sb = new StringBuilder();

        if (customPrompt != null && !customPrompt.isBlank()) {
            sb.append("--- Ghi chú bổ sung từ admin ---\n");
            sb.append(customPrompt).append("\n");
            sb.append("--- Kết thúc ghi chú ---\n\n");
        }

        sb.append("Bạn là chuyên gia tạo câu hỏi trắc nghiệm Kinh Thánh. ");
        sb.append("Hãy tạo đúng ").append(count).append(" câu hỏi dựa trên ").append(ref).append(".\n\n");

        sb.append("Ngôn ngữ: ").append(langName).append("\n");
        sb.append("Độ khó: ").append(difficulty).append(" — ").append(difficultyNote).append("\n");
        sb.append("Loại câu hỏi: ").append(typeInstruction).append("\n\n");

        if (scriptureText != null && !scriptureText.isBlank()) {
            sb.append("Nội dung đoạn Kinh Thánh:\n").append(scriptureText).append("\n\n");
        }

        sb.append("Trả về ONLY một mảng JSON hợp lệ (không markdown, không text thừa) với đúng ")
          .append(count).append(" object:\n");
        sb.append("[\n  {\n");
        sb.append("    \"content\": \"nội dung câu hỏi bằng ").append(langName).append("\",\n");
        sb.append("    \"type\": \"").append(type).append("\",\n");
        sb.append("    \"difficulty\": \"").append(difficulty).append("\",\n");
        sb.append("    \"language\": \"").append(language).append("\",\n");
        sb.append("    \"options\": [\"Lựa chọn A\", \"Lựa chọn B\", \"Lựa chọn C\", \"Lựa chọn D\"],\n");
        sb.append("    \"correctAnswer\": 0,\n");
        sb.append("    \"explanation\": \"giải thích ngắn gọn bằng ").append(langName).append("\",\n");
        sb.append("    \"book\": \"").append(book).append("\",\n");
        sb.append("    \"chapter\": ").append(chapter).append(",\n");
        sb.append("    \"verseStart\": ").append(verseStart).append(",\n");
        sb.append("    \"verseEnd\": ").append(verseEnd).append(",\n");
        sb.append("    \"tags\": [\"").append(book.toLowerCase().replace(" ", ""))
          .append("\", \"chapter").append(chapter).append("\"],\n");
        sb.append("    \"source\": \"").append(isVi ? "Kinh Thánh" : "Holy Bible").append("\"\n");
        sb.append("  }\n]\n\n");
        sb.append("Quan trọng: mỗi câu hỏi phải chính xác về mặt Kinh Thánh, dựa trên nội dung thực của ").append(ref).append(".");

        return sb.toString();
    }
}
