import React, { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface Message {
  id: string;
  sender: 'user' | 'ai' | 'system';
  text: string;
  timestamp: Date;
}

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const AIKnowledgeAssistant: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [messageInput, setMessageInput] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [demoChatHistory, setDemoChatHistory] = useState<Message[]>([]);

  // tRPC calls
  const aiChatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      const newMessage: Message = {
        id: String(chatHistory.length + 1),
        sender: 'ai',
        text: data.response || 'No response from AI.',
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, newMessage]);
      toast.success('AI response received!');
      trpc.ai.getHistory.invalidate(); // Invalidate chat history after new message
    },
    onError: (error) => {
      toast.error(`AI Chat Error: ${error.message}`);
    },
  });

  const knowledgeGraphQueryMutation = trpc.knowledgeGraph.query.useMutation({
    onSuccess: (data) => {
      const newMessage: Message = {
        id: String(chatHistory.length + 1),
        sender: 'system',
        text: `Knowledge Graph: ${data.result || 'No knowledge graph result.'}`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, newMessage]);
      toast.success('Knowledge graph query successful!');
      trpc.knowledgeGraph.entities.invalidate(); // Invalidate entities if query might affect them
    },
    onError: (error) => {
      toast.error(`Knowledge Graph Error: ${error.message}`);
    },
  });

  const { data: realChatHistory, isLoading: chatHistoryLoading, error: chatHistoryError } = trpc.ai.getHistory.useQuery(undefined, {
    enabled: isAuthenticated && !DEMO_MODE,
  });

  const { data: knowledgeGraphEntities, isLoading: kgEntitiesLoading, error: kgEntitiesError } = trpc.knowledgeGraph.entities.useQuery(undefined, {
    enabled: isAuthenticated && !DEMO_MODE,
  });

  useEffect(() => {
    if (realChatHistory && !DEMO_MODE) {
      const formattedHistory: Message[] = realChatHistory.map((msg: any, index: number) => ({
        id: msg.id || String(index),
        sender: msg.sender === 'user' ? 'user' : 'ai',
        text: msg.text,
        timestamp: new Date(msg.timestamp),
      }));
      setChatHistory(formattedHistory);
    }
  }, [realChatHistory, DEMO_MODE]);

  useEffect(() => {
    if (chatHistoryError) {
      toast.error(`Failed to load chat history: ${chatHistoryError.message}`);
    }
    if (kgEntitiesError) {
      toast.error(`Failed to load knowledge graph entities: ${kgEntitiesError.message}`);
    }
  }, [chatHistoryError, kgEntitiesError]);

  // Demo Mode Data
  useEffect(() => {
    if (DEMO_MODE) {
      setDemoChatHistory([
        { id: '1', sender: 'user', text: 'What is comprehensive motor insurance?', timestamp: new Date(Date.now() - 60000) },
        { id: '2', sender: 'ai', text: 'Comprehensive motor insurance covers damages to your vehicle, third-party liabilities, and theft. It offers broader protection than third-party only insurance.', timestamp: new Date(Date.now() - 50000) },
        { id: '3', sender: 'user', text: 'Tell me about NAICOM regulations for microinsurance.', timestamp: new Date(Date.now() - 40000) },
        { id: '4', sender: 'system', text: 'NAICOM (National Insurance Commission) regulates microinsurance in Nigeria to ensure financial inclusion and consumer protection. Key regulations include capital requirements, permissible products, and distribution channels.', timestamp: new Date(Date.now() - 30000) },
      ]);
    }
  }, [DEMO_MODE]);

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;

    const userMessage: Message = {
      id: String(chatHistory.length + 1),
      sender: 'user',
      text: messageInput,
      timestamp: new Date(),
    };

    if (DEMO_MODE) {
      setDemoChatHistory((prev) => [...prev, userMessage]);
      setMessageInput('');
      // Simulate AI response in demo mode
      setTimeout(() => {
        const demoResponse: Message = {
          id: String(demoChatHistory.length + 2),
          sender: 'ai',
          text: `Demo AI: You asked about '${userMessage.text}'. This is a simulated response.`, 
          timestamp: new Date(),
        };
        setDemoChatHistory((prev) => [...prev, demoResponse]);
      }, 1500);
      return;
    }

    setChatHistory((prev) => [...prev, userMessage]);
    setMessageInput('');

    // Determine if it's an AI chat or Knowledge Graph query based on keywords
    if (messageInput.toLowerCase().includes('knowledge graph') || messageInput.toLowerCase().includes('entities')) {
      await knowledgeGraphQueryMutation.mutateAsync({ question: userMessage.text });
    } else {
      await aiChatMutation.mutateAsync({ message: userMessage.text, context: chatHistory.map(msg => msg.text).join('\n') });
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="w-full max-w-md mx-auto mt-10">
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Please log in to access the AI Knowledge Assistant.</p>
        </CardContent>
      </Card>
    );
  }

  const currentChatHistory = DEMO_MODE ? demoChatHistory : chatHistory;

  return (
    <Card className="w-full max-w-3xl mx-auto mt-5">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          AI Knowledge Assistant
          {DEMO_MODE && <Badge variant="secondary">DEMO MODE</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] w-full pr-4 mb-4">
          {currentChatHistory.map((msg) => (
            <div
              key={msg.id}
              className={`flex mb-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] p-2 rounded-lg ${msg.sender === 'user'
                  ? 'bg-blue-500 text-white'
                  : msg.sender === 'ai'
                    ? 'bg-gray-200 text-gray-800'
                    : 'bg-purple-200 text-purple-800' // System messages for KG
                }`}
              >
                <p className="text-sm font-semibold">{msg.sender === 'user' ? 'You' : msg.sender === 'ai' ? 'AI' : 'System'}</p>
                <p className="text-sm">{msg.text}</p>
                <p className="text-xs text-right opacity-75 mt-1">
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          {(chatHistoryLoading || kgEntitiesLoading || aiChatMutation.isLoading || knowledgeGraphQueryMutation.isLoading) && (
            <div className="flex justify-center items-center mt-4">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          )}
        </ScrollArea>
        <div className="flex gap-2">
          <Input
            placeholder="Ask a question or query the knowledge graph..."
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSendMessage();
              }
            }}
            disabled={aiChatMutation.isLoading || knowledgeGraphQueryMutation.isLoading}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || aiChatMutation.isLoading || knowledgeGraphQueryMutation.isLoading}
          >
            {aiChatMutation.isLoading || knowledgeGraphQueryMutation.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Send'
            )}
          </Button>
        </div>
        {!DEMO_MODE && knowledgeGraphEntities && knowledgeGraphEntities.length > 0 && (
          <div className="mt-4">
            <h3 className="text-md font-semibold mb-2">Knowledge Graph Entities:</h3>
            <div className="flex flex-wrap gap-2">
              {knowledgeGraphEntities.map((entity: any) => (
                <Badge key={entity.id} variant="outline">{entity.name}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AIKnowledgeAssistant;