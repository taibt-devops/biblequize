package com.biblequiz.modules.room.service;

import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.user.entity.User;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Thông tin phòng gửi cho giao diện phải mang cờ Đấu nhanh và Hội ý (sảnh chờ quyết định nút theo đó). */
class RoomDetailsDTOTest {

    @Test
    void carriesQuickMatchAndTeamConsensusFlags() {
        User host = new User();
        host.setId("h");
        Room room = new Room();
        room.setId("r");
        room.setHost(host);
        room.setQuickMatch(true);
        room.setTeamConsensus(true);

        RoomService.RoomDetailsDTO dto = new RoomService.RoomDetailsDTO(room, List.of());

        assertTrue(dto.quickMatch);
        assertTrue(dto.teamConsensus);
    }
}
