package com.biblequiz.modules.userquiz.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "question_set_items")
public class QuestionSetItem {

    @Id
    @Column(length = 36)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "set_id", nullable = false)
    private QuestionSet questionSet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    private UserQuestion userQuestion;

    @Column(name = "order_index", nullable = false)
    private int orderIndex;

    public QuestionSetItem() {}

    public QuestionSetItem(String id, QuestionSet set, UserQuestion question, int orderIndex) {
        this.id = id;
        this.questionSet = set;
        this.userQuestion = question;
        this.orderIndex = orderIndex;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public QuestionSet getQuestionSet() { return questionSet; }
    public void setQuestionSet(QuestionSet questionSet) { this.questionSet = questionSet; }

    public UserQuestion getUserQuestion() { return userQuestion; }
    public void setUserQuestion(UserQuestion userQuestion) { this.userQuestion = userQuestion; }

    public int getOrderIndex() { return orderIndex; }
    public void setOrderIndex(int orderIndex) { this.orderIndex = orderIndex; }
}
