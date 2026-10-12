package com.biblequiz.infrastructure.exception;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Gọi sai method (vd app cũ POST vào đường đã gỡ như /api/user-questions/generate, khớp mẫu /{id} chỉ có
 * PUT/DELETE) là lỗi của người gọi: 405, không phải 500 "Unexpected error" ghi ERROR.
 */
class GlobalExceptionHandlerMethodTest {

    @RestController
    static class OnlyGet {
        @GetMapping("/things/{id}")
        String one() { return "ok"; }
    }

    @Test
    void wrongHttpMethod_is405_not500() throws Exception {
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new OnlyGet())
                .setControllerAdvice(new GlobalExceptionHandler(new ObjectMapper()))
                .build();

        mvc.perform(post("/things/generate"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.status").value(405));
    }
}
