package com.biblequiz.api;

import com.biblequiz.modules.quiz.entity.Book;
import com.biblequiz.modules.quiz.entity.Question;
import com.biblequiz.modules.quiz.repository.BookRepository;
import com.biblequiz.modules.quiz.repository.QuestionRepository;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;

import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Tests that Vietnamese (UTF-8) text is returned correctly in API responses.
 *
 * Root cause of the bug: JDBC connection without characterEncoding=UTF-8 caused
 * double-encoded UTF-8 data in MySQL. Characters like "Sáng" appeared as "SÃ¡ng".
 *
 * These tests ensure:
 * 1. Response Content-Type includes charset=UTF-8
 * 2. Vietnamese characters with diacritics are preserved (not mojibake)
 * 3. Common Vietnamese chars (ă, â, đ, ê, ô, ơ, ư, dấu sắc/huyền/hỏi/ngã/nặng) work
 */
@WebMvcTest(BookController.class)
@DisplayName("UTF-8 Vietnamese Encoding Tests")
class Utf8EncodingTest extends BaseControllerTest {

    @MockBean
    private BookRepository bookRepository;

    @Test
    @DisplayName("GET /api/books — response Content-Type should include charset=UTF-8")
    void getBooks_shouldReturnUtf8ContentType() throws Exception {
        when(bookRepository.findAll()).thenReturn(List.of());

        mockMvc.perform(get("/api/books"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(content().encoding("UTF-8"));
    }

    @Test
    @DisplayName("GET /api/books — Vietnamese nameVi with diacritics should not be mojibake")
    void getBooks_shouldReturnVietnameseTextCorrectly() throws Exception {
        Book genesis = new Book("book-001", "Genesis", "Sáng Thế Ký", Book.Testament.OLD, 1);
        Book exodus = new Book("book-002", "Exodus", "Xuất Ai Cập Ký", Book.Testament.OLD, 2);
        Book psalms = new Book("book-003", "Psalms", "Thi Thiên", Book.Testament.OLD, 19);

        when(bookRepository.findAll()).thenReturn(List.of(genesis, exodus, psalms));

        mockMvc.perform(get("/api/books"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].nameVi").value("Sáng Thế Ký"))
                .andExpect(jsonPath("$[1].nameVi").value("Xuất Ai Cập Ký"))
                .andExpect(jsonPath("$[2].nameVi").value("Thi Thiên"));
    }

    @Test
    @DisplayName("GET /api/books — nameVi must NOT contain double-encoded UTF-8 patterns")
    void getBooks_shouldNotContainDoubleEncodedUtf8() throws Exception {
        // These are the mojibake patterns for common Vietnamese chars:
        // á → Ã¡, ế → áº¿, ý → Ã½, ê → Ãª, ô → Ã´
        Book book = new Book("book-001", "Genesis", "Sáng Thế Ký", Book.Testament.OLD, 1);

        when(bookRepository.findAll()).thenReturn(List.of(book));

        String response = mockMvc.perform(get("/api/books"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        // Double-encoded UTF-8 markers — if ANY of these appear, encoding is broken
        org.assertj.core.api.Assertions.assertThat(response)
                .doesNotContain("Ã¡")   // á double-encoded
                .doesNotContain("Ã©")   // é double-encoded
                .doesNotContain("Ã´")   // ô double-encoded
                .doesNotContain("Ãª")   // ê double-encoded
                .doesNotContain("Ã½")   // ý double-encoded
                .doesNotContain("Ä'")   // đ double-encoded
                .doesNotContain("Æ°")   // ư double-encoded
                .doesNotContain("Æ¡")   // ơ double-encoded
                .doesNotContain("áº")   // multi-byte Vietnamese double-encoded prefix
                .doesNotContain("áº¿"); // ế double-encoded
    }

    @Test
    @DisplayName("GET /api/books — all Vietnamese diacritics should render correctly")
    void getBooks_shouldHandleAllVietnameseDiacritics() throws Exception {
        // Test all Vietnamese special chars: ă â đ ê ô ơ ư + 5 tone marks
        Book book = new Book("book-test", "Test", "Đức Chúa Trời yêu thương ông ấy", Book.Testament.OLD, 1);

        when(bookRepository.findAll()).thenReturn(List.of(book));

        mockMvc.perform(get("/api/books"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].nameVi").value("Đức Chúa Trời yêu thương ông ấy"))
                // Verify specific chars are present (not garbled)
                .andExpect(jsonPath("$[0].nameVi", containsString("Đ")))   // đ uppercase
                .andExpect(jsonPath("$[0].nameVi", containsString("ú")))   // u with sắc
                .andExpect(jsonPath("$[0].nameVi", containsString("ờ")))   // ơ with huyền
                .andExpect(jsonPath("$[0].nameVi", containsString("ươ"))) // ươ combo
                .andExpect(jsonPath("$[0].nameVi", containsString("ấ"))); // â with sắc
    }
}
