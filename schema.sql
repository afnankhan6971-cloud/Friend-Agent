-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create conversations table
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    message_type TEXT NOT NULL CHECK (message_type IN ('text', 'image')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create memories table
CREATE TABLE public.memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    memory TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('personal', 'preference', 'education', 'project', 'important_event', 'communication_style')),
    importance NUMERIC(3,2) NOT NULL DEFAULT 0.5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create attachments table
CREATE TABLE public.attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Setup Row Level Security (RLS)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Note: Since we are building a prototype, we'll create policies assuming user_id maps to auth.uid()
CREATE POLICY "Users can manage their own conversations" 
ON public.conversations FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own messages" 
ON public.messages FOR ALL USING (
    EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND c.user_id = auth.uid())
);

CREATE POLICY "Users can manage their own memories" 
ON public.memories FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own attachments" 
ON public.attachments FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.messages m 
        JOIN public.conversations c ON c.id = m.conversation_id 
        WHERE m.id = attachments.message_id AND c.user_id = auth.uid()
    )
);
