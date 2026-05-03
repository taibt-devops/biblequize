package com.biblequiz.modules.userquiz.entity;

import com.biblequiz.modules.room.entity.Room;
import jakarta.persistence.*;

@Entity
@Table(name = "room_question_selections")
public class RoomQuestionSelection {

    @Id
    @Column(length = 36)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_question_id", nullable = false)
    private UserQuestion userQuestion;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex = 0;

    public RoomQuestionSelection() {}

    public RoomQuestionSelection(String id, Room room, UserQuestion userQuestion, int orderIndex) {
        this.id = id;
        this.room = room;
        this.userQuestion = userQuestion;
        this.orderIndex = orderIndex;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Room getRoom() { return room; }
    public void setRoom(Room room) { this.room = room; }

    public UserQuestion getUserQuestion() { return userQuestion; }
    public void setUserQuestion(UserQuestion userQuestion) { this.userQuestion = userQuestion; }

    public Integer getOrderIndex() { return orderIndex; }
    public void setOrderIndex(Integer orderIndex) { this.orderIndex = orderIndex; }
}
