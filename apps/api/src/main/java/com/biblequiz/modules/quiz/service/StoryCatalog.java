package com.biblequiz.modules.quiz.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * The 120 "Dễ cốt lõi" stories Practice can play one at a time ("Theo câu chuyện").
 *
 * <p>Read once from {@code seed/stories/stories.json}, which
 * {@code content/easy-core/build.py export} writes from {@code stories.md} together with
 * the questions ({@code seed/questions/easy_core_quiz.json}, whose {@code story} field is
 * a story {@link Story#id()} here). Each story also carries an English title and
 * reference ({@code content/en/stories_en.json}) for the English questions, which use the
 * same story ids.
 */
@Component
public class StoryCatalog {

    private static final Logger log = LoggerFactory.getLogger(StoryCatalog.class);

    static final String RESOURCE = "seed/stories/stories.json";

    /**
     * One story; {@code testament} is "OT" or "NT", {@code order} its number in stories.md.
     * {@code title}/{@code ref} are Vietnamese, {@code titleEn}/{@code refEn} English.
     */
    public record Story(String id, int order, String title, String ref, String testament,
                        String titleEn, String refEn) {

        public Story(String id, int order, String title, String ref, String testament) {
            this(id, order, title, ref, testament, null, null);
        }

        /** Title in the question language; English falls back to Vietnamese when missing. */
        public String title(String language) {
            return "en".equals(language) && titleEn != null ? titleEn : title;
        }

        public String ref(String language) {
            return "en".equals(language) && refEn != null ? refEn : ref;
        }
    }

    private final List<Story> stories;
    private final Map<String, Story> byId = new LinkedHashMap<>();

    @Autowired
    public StoryCatalog(ObjectMapper objectMapper) {
        this(load(objectMapper));
    }

    StoryCatalog(List<Story> stories) {
        this.stories = stories.stream().sorted(Comparator.comparingInt(Story::order)).toList();
        this.stories.forEach(s -> byId.put(s.id(), s));
    }

    /** Every story in canonical order (Genesis first). */
    public List<Story> all() {
        return stories;
    }

    public Optional<Story> find(String id) {
        return Optional.ofNullable(id == null ? null : byId.get(id));
    }

    private static List<Story> load(ObjectMapper objectMapper) {
        ClassPathResource resource = new ClassPathResource(RESOURCE);
        if (!resource.exists()) {
            log.warn("StoryCatalog: {} not found, Practice will list no stories", RESOURCE);
            return List.of();
        }
        try (InputStream in = resource.getInputStream()) {
            List<Story> stories = objectMapper.readValue(in, new TypeReference<List<Story>>() {});
            log.info("StoryCatalog: {} stories", stories.size());
            return stories;
        } catch (IOException e) {
            // Never fail startup over the catalog; Practice just shows no stories.
            log.error("StoryCatalog: failed to read {}", RESOURCE, e);
            return List.of();
        }
    }
}
