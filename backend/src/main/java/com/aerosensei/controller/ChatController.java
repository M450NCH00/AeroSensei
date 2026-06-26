package com.aerosensei.controller;

import com.aerosensei.dto.AppendMessagesRequest;
import com.aerosensei.dto.ChatConversationResponse;
import com.aerosensei.dto.ChatMessageResponse;
import com.aerosensei.service.ChatService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

/**
 * Persistent AI-assistant chat history. Every endpoint is scoped to the
 * authenticated user (any logged-in role may keep their own history).
 */
@RestController
@RequestMapping("/api/chat")
@PreAuthorize("isAuthenticated()")
public class ChatController {

    @Autowired
    private ChatService chatService;

    /** GET /api/chat/conversations — the caller's conversations, newest first. */
    @GetMapping("/conversations")
    public ResponseEntity<List<ChatConversationResponse>> list(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(chatService.listConversations(email));
    }

    /** POST /api/chat/conversations — start a new conversation (optional title). */
    @PostMapping("/conversations")
    public ResponseEntity<ChatConversationResponse> create(@AuthenticationPrincipal String email,
                                                           @RequestBody(required = false) Map<String, String> body) {
        String title = body != null ? body.get("title") : null;
        return ResponseEntity.status(HttpStatus.CREATED).body(chatService.createConversation(email, title));
    }

    /** GET /api/chat/conversations/{id}/messages — a conversation's messages. */
    @GetMapping("/conversations/{id}/messages")
    public ResponseEntity<?> messages(@AuthenticationPrincipal String email, @PathVariable Long id) {
        try {
            return ResponseEntity.ok(chatService.getMessages(email, id));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /** POST /api/chat/conversations/{id}/messages — append a turn (one or more messages). */
    @PostMapping("/conversations/{id}/messages")
    public ResponseEntity<?> append(@AuthenticationPrincipal String email, @PathVariable Long id,
                                    @RequestBody AppendMessagesRequest req) {
        try {
            List<ChatMessageResponse> saved = chatService.appendMessages(email, id, req);
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    /** DELETE /api/chat/conversations/{id} — delete a conversation and its messages. */
    @DeleteMapping("/conversations/{id}")
    public ResponseEntity<?> delete(@AuthenticationPrincipal String email, @PathVariable Long id) {
        try {
            chatService.deleteConversation(email, id);
            return ResponseEntity.noContent().build();
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
