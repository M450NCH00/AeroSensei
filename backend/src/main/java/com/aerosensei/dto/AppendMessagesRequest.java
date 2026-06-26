package com.aerosensei.dto;

import java.util.List;

/** Append one or more messages (a full turn) to a conversation. */
public class AppendMessagesRequest {

    private List<Item> messages;

    public List<Item> getMessages() { return messages; }
    public void setMessages(List<Item> messages) { this.messages = messages; }

    public static class Item {
        private String role;     // 'user' | 'assistant'
        private String content;

        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }

        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }
    }
}
