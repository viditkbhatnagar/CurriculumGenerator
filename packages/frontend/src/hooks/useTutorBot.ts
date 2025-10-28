import { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ChatMessage, TutorResponse, ChatRequest } from '@/types/tutorBot';

export function useTutorBot(studentId: string, courseId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // Fetch conversation history
  const { data: history, isLoading } = useQuery({
    queryKey: ['tutor-history', studentId, courseId],
    queryFn: async () => {
      const response = await api.get(`/api/tutor/history/${studentId}`, {
        params: { courseId },
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data?.messages) {
        setMessages(data.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })));
      }
    },
  });

  // Send chat message
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const request: ChatRequest = {
        studentId,
        message,
        courseId,
      };
      const response = await api.post('/api/tutor/chat', request);
      return response.data as TutorResponse;
    },
    onMutate: async (message: string) => {
      // Optimistically add student message
      const studentMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: 'student',
        content: message,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, studentMessage]);
      setIsTyping(true);
    },
    onSuccess: (data: TutorResponse) => {
      // Add tutor response
      const tutorMessage: ChatMessage = {
        id: `tutor-${Date.now()}`,
        role: 'tutor',
        content: data.message,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, tutorMessage]);
      setIsTyping(false);
    },
    onError: (error) => {
      console.error('Error sending message:', error);
      setIsTyping(false);
      // Add error message
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'tutor',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    },
  });

  const sendMessage = useCallback(
    (message: string) => {
      if (!message.trim()) return;
      sendMessageMutation.mutate(message);
    },
    [sendMessageMutation]
  );

  // Track resource engagement
  const trackResourceMutation = useMutation({
    mutationFn: async (resourceId: string) => {
      await api.post('/api/tutor/track-resource', {
        studentId,
        courseId,
        resourceId,
      });
    },
  });

  const trackResource = useCallback(
    (resourceId: string) => {
      trackResourceMutation.mutate(resourceId);
    },
    [trackResourceMutation]
  );

  return {
    messages,
    isLoading,
    isTyping,
    sendMessage,
    trackResource,
    lastResponse: sendMessageMutation.data,
  };
}
