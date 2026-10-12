package com.biblequiz.infrastructure;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.stereotype.Component;

import java.lang.reflect.Constructor;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Bean có nhiều constructor mà không chỉ rõ cái nào dùng cho Spring sẽ làm app không khởi động được
 * ("No default constructor found"). Bộ test đơn vị không dựng Spring context nên lỗi này chỉ lộ ra
 * khi chạy jar — PCV-1 đã dính (RoomAnswerProcessor thêm constructor nhận đồng hồ cho test).
 *
 * <p>Luật giống Spring: một constructor duy nhất, hoặc đúng một constructor có {@code @Autowired},
 * hoặc có constructor không tham số.
 */
class BeanConstructorResolutionTest {

    @Test
    void everyComponentHasAConstructorSpringCanChoose() throws Exception {
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Component.class));

        List<String> ambiguous = new ArrayList<>();
        int scanned = 0;
        for (BeanDefinition def : scanner.findCandidateComponents("com.biblequiz")) {
            Class<?> type = Class.forName(def.getBeanClassName());
            if (type.isInterface() || Modifier.isAbstract(type.getModifiers())) continue;
            scanned++;
            Constructor<?>[] ctors = type.getDeclaredConstructors();
            if (ctors.length == 1) continue;
            long autowired = Arrays.stream(ctors).filter(c -> c.isAnnotationPresent(Autowired.class)).count();
            boolean hasNoArg = Arrays.stream(ctors).anyMatch(c -> c.getParameterCount() == 0);
            if (autowired == 1 || (autowired == 0 && hasNoArg)) continue;
            ambiguous.add(type.getName() + " (" + ctors.length + " constructors, " + autowired + " @Autowired)");
        }

        assertTrue(scanned > 100, "scanner found only " + scanned + " components");
        assertTrue(ambiguous.isEmpty(), "Spring cannot choose a constructor for: " + ambiguous);
    }
}
