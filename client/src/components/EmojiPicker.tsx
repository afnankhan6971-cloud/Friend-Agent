import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: string[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    name: 'Smileys & Emotion',
    icon: '😊',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
      '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
      '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪',
      '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒',
      '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫',
      '🥺', '😢', '😭', '😤', '😠', '😡', '🤯', '😳',
      '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
      '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬',
    ],
  },
  {
    id: 'gestures',
    name: 'Gestures & People',
    icon: '👍',
    emojis: [
      '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙',
      '👈', '👉', '👆', '👇', '✋', '🤚', '🖐️', '🖖',
      '👋', '🤝', '👏', '🙌', '👐', '🤲', '🙏', '✍️',
      '💪', '🦾', '🧠', '🫀', '👀', '👁️', '👂', '👃',
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
    ],
  },
  {
    id: 'symbols',
    name: 'Symbols & Objects',
    icon: '✨',
    emojis: [
      '✨', '⭐', '🌟', '💫', '🔥', '💥', '⚡', '🎉',
      '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '🎯',
      '💡', '📚', '📖', '📝', '📌', '📍', '🚀', '🛸',
      '🔔', '🔕', '💬', '💭', '🗯️', '✔️', '❌', '💯',
      '⚠️', '🚫', '⛔', '✅', '🆗', '🆒', '🆕', '🆓',
      '☀️', '🌙', '☁️', '🌧️', '❄️', '🌈', '💎', '🔑',
    ],
  },
  {
    id: 'nature_food',
    name: 'Nature & Food',
    icon: '🌿',
    emojis: [
      '🌸', '🌹', '🌺', '🌻', '🌼', '🌷', '🌱', '🌿',
      '🍀', '🍁', '🍂', '🍃', '🐶', '🐱', '🐭', '🐹',
      '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮',
      '☕', '🍵', '🧃', '🥤', '🍺', '🍻', '🥂', '🍷',
      '🍕', '🍔', '🍟', '🌭', '🍿', '🥪', '🌮', '🍣',
      '🍎', '🍓', '🍇', '🍉', '🍌', '🍑', '🥑', '🍩',
    ],
  },
];

interface EmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  isOpen,
  onClose,
  onSelectEmoji,
  triggerRef,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>(EMOJI_CATEGORIES[0].id);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click/tap outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handlePointerDownOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        pickerRef.current &&
        !pickerRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDownOutside);
    document.addEventListener('touchstart', handlePointerDownOutside, { passive: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('touchstart', handlePointerDownOutside);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  const currentCategory =
    EMOJI_CATEGORIES.find((cat) => cat.id === activeCategory) || EMOJI_CATEGORIES[0];

  return (
    <div
      ref={pickerRef}
      role="dialog"
      aria-label="Emoji Picker"
      className="absolute bottom-full mb-2 left-0 sm:left-2 w-[calc(100vw-2rem)] sm:w-80 max-w-[340px] bg-surface-1 border border-border rounded-2xl shadow-2xl z-40 overflow-hidden flex flex-col backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 select-none"
      style={{ maxHeight: '310px' }}
    >
      {/* Category Tabs Header */}
      <div className="flex items-center justify-between gap-1 p-1.5 border-b border-border/60 bg-surface-1/90">
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          {EMOJI_CATEGORIES.map((cat) => {
            const isActive = cat.id === activeCategory;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                title={cat.name}
                aria-label={cat.name}
                aria-selected={isActive}
                className={`h-8 w-8 rounded-xl flex items-center justify-center text-base transition shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm scale-105'
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface-2'
                }`}
              >
                <span>{cat.icon}</span>
              </button>
            );
          })}
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close emoji picker"
          className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-2 transition shrink-0 cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Category Name Label */}
      <div className="px-3 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-surface-2/40 border-b border-border/40 shrink-0">
        {currentCategory.name}
      </div>

      {/* Emoji Grid */}
      <div
        className="p-2 overflow-y-auto grid grid-cols-7 gap-1 flex-1 overscroll-contain"
        tabIndex={-1}
      >
        {currentCategory.emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onMouseDown={(e) => {
              // Prevent textarea blur on desktop
              e.preventDefault();
            }}
            onClick={() => onSelectEmoji(emoji)}
            aria-label={emoji}
            className="w-full aspect-square flex items-center justify-center text-xl rounded-xl hover:bg-surface-2 active:scale-90 transition cursor-pointer"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
