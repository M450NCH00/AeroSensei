package com.aerosensei.service;

import com.aerosensei.dto.AppendMessagesRequest;
import com.aerosensei.dto.ChatConversationResponse;
import com.aerosensei.dto.ChatMessageResponse;
import com.aerosensei.entity.ChatConversation;
import com.aerosensei.entity.ChatMessage;
import com.aerosensei.entity.User;
import com.aerosensei.repository.ChatConversationRepository;
import com.aerosensei.repository.ChatMessageRepository;
import com.aerosensei.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Per-user persistence of AI-assistant chat history. Every operation is scoped to
 * the authenticated user's email so one user can never read or mutate another's
 * conversations.
 */
@Service
public class ChatService {

    private static final Set<String> VALID_ROLES = Set.of("user", "assistant");

    @Autowired
    private ChatConversationRepository conversationRepository;

    @Autowired
    private ChatMessageRepository messageRepository;

    @Autowired
    private UserRepository userRepository;

    @Transactional
    public ChatConversationResponse createConversation(String email, String title) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new NoSuchElementException("User not found"));
        ChatConversation c = new ChatConversation();
        c.setUser(user);
        c.setTitle(trimTitle(title));
        c.setUpdatedAt(LocalDateTime.now());
        return toConversationDto(conversationRepository.save(c));
    }

    @Transactional(readOnly = true)
    public List<ChatConversationResponse> listConversations(String email) {
        return conversationRepository.findByUser_EmailOrderByUpdatedAtDesc(email).stream()
                .map(this::toConversationDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ChatMessageResponse> getMessages(String email, Long conversationId) {
        requireOwned(email, conversationId);
        return messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId).stream()
                .map(m -> new ChatMessageResponse(m.getId(), m.getRole(), m.getContent(), m.getCreatedAt()))
                .collect(Collectors.toList());
    }

    @Transactional
    public List<ChatMessageResponse> appendMessages(String email, Long conversationId,
                                                    AppendMessagesRequest req) {
        ChatConversation conv = requireOwned(email, conversationId);
        List<AppendMessagesRequest.Item> items = req != null ? req.getMessages() : null;
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("No messages provided");
        }
        for (AppendMessagesRequest.Item item : items) {
            String role = item.getRole() == null ? "" : item.getRole().toLowerCase();
            String content = item.getContent();
            if (!VALID_ROLES.contains(role) || content == null || content.isBlank()) {
                throw new IllegalArgumentException("Each message needs a valid role (user|assistant) and content");
            }
            ChatMessage m = new ChatMessage();
            m.setConversationId(conversationId);
            m.setRole(role);
            m.setContent(content);
            messageRepository.save(m);
            // Title the conversation from its first user message if not set yet.
            if (conv.getTitle() == null && "user".equals(role)) {
                conv.setTitle(trimTitle(content));
            }
        }
        conv.setUpdatedAt(LocalDateTime.now());
        conversationRepository.save(conv);
        return getMessages(email, conversationId);
    }

    @Transactional
    public void deleteConversation(String email, Long conversationId) {
        ChatConversation conv = requireOwned(email, conversationId);
        conversationRepository.delete(conv); // chat_messages cascade-deleted by FK
    }

    // --- helpers ---

    /** Loads a conversation the caller owns, or throws (treated as 404 by the controller). */
    private ChatConversation requireOwned(String email, Long conversationId) {
        return conversationRepository.findByIdAndUser_Email(conversationId, email)
                .orElseThrow(() -> new NoSuchElementException("Conversation not found"));
    }

    private String trimTitle(String s) {
        if (s == null) return null;
        String t = s.strip();
        if (t.isEmpty()) return null;
        return t.length() > 80 ? t.substring(0, 80) : t;
    }

    private ChatConversationResponse toConversationDto(ChatConversation c) {
        return new ChatConversationResponse(c.getId(), c.getTitle(), c.getCreatedAt(), c.getUpdatedAt());
    }
}
