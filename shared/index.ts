export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  message_type: 'text' | 'image';
  created_at: string;
  attachments?: Attachment[];
  imageUrl?: string;
  originalImageUrl?: string;
  status?: 'generating' | 'completed' | 'failed';
  error?: string;
  canRetry?: boolean;
}

export interface Memory {
  id: string;
  user_id: string;
  memory: string;
  category: 'personal' | 'preference' | 'education' | 'project' | 'important_event' | 'communication_style';
  importance: number;
  created_at: string;
}

export interface Attachment {
  id: string;
  message_id: string;
  file_path: string;
  file_type: string;
  created_at: string;
  url?: string;
}
