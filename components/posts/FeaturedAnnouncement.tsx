"use client";

import React, { useState } from "react";
import { Megaphone, Calendar, User, ArrowRight, Sparkles } from "lucide-react";
import { PostDetailModal } from "./PostDetailModal";
import type { PostWithAuthor } from "@/types/posts";

interface FeaturedAnnouncementProps {
  post: {
    id: string;
    title: string;
    excerpt?: string | null;
    content: string;
    published_at?: string | null;
    created_at: string;
    authorName?: string;
  };
  isAdmin?: boolean;
}

export function FeaturedAnnouncement({
  post,
  isAdmin = false,
}: FeaturedAnnouncementProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const formattedDate = post.published_at || post.created_at
    ? new Date(post.published_at || post.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const postWithAuthor: PostWithAuthor = {
    id: post.id,
    title: post.title,
    slug: post.id,
    content: post.content,
    excerpt: post.excerpt || "",
    status: "published",
    featured_image_url: "",
    tags: [],
    author_id: "",
    published_at: post.published_at || post.created_at,
    created_at: post.created_at,
    updated_at: post.created_at,
    deleted_at: null,
    author: {
      id: "",
      username: post.authorName || "admin",
      full_name: post.authorName || "Administrator",
      avatar_url: "",
    },
  };

  return (
    <>
      <div className="announcement-banner">
        <div className="banner-glow" />
        <div className="banner-content">
          <div className="banner-badge-row">
            <span className="banner-pill">
              <Megaphone size={13} className="pill-icon" />
              Latest Admin Message
            </span>
            {formattedDate && (
              <span className="banner-date">
                <Calendar size={12} />
                {formattedDate}
              </span>
            )}
          </div>

          <h2 className="banner-title">{post.title}</h2>

          {post.excerpt && (
            <p className="banner-excerpt">{post.excerpt}</p>
          )}

          <div className="banner-footer">
            <div className="banner-author">
              <div className="author-circle">
                <User size={13} />
              </div>
              <span className="author-name">
                Posted by {post.authorName || "Administrator"}
              </span>
            </div>

            <button
              type="button"
              className="read-more-btn"
              onClick={() => setModalOpen(true)}
              aria-label={`Read announcement: ${post.title}`}
            >
              <span>Read Full Message</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <PostDetailModal
          post={postWithAuthor}
          onClose={() => setModalOpen(false)}
          isAdmin={isAdmin}
          onEdit={() => {}}
        />
      )}

      <style jsx>{`
        .announcement-banner {
          position: relative;
          border-radius: var(--radius-xl);
          background: linear-gradient(
            135deg,
            rgba(99, 102, 241, 0.12) 0%,
            rgba(139, 92, 246, 0.08) 50%,
            rgba(255, 255, 255, 0.03) 100%
          );
          border: 1px solid rgba(99, 102, 241, 0.25);
          box-shadow: 0 4px 20px rgba(99, 102, 241, 0.08);
          overflow: hidden;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .announcement-banner:hover {
          border-color: rgba(99, 102, 241, 0.4);
          box-shadow: 0 8px 30px rgba(99, 102, 241, 0.14);
        }
        .banner-glow {
          position: absolute;
          top: -30px;
          right: -30px;
          width: 140px;
          height: 140px;
          background: radial-gradient(
            circle,
            rgba(99, 102, 241, 0.25) 0%,
            transparent 70%
          );
          pointer-events: none;
          filter: blur(20px);
        }
        .banner-content {
          padding: var(--space-5) var(--space-6);
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .banner-badge-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: var(--space-2);
        }
        .banner-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: var(--radius-full);
          background: rgba(99, 102, 241, 0.2);
          color: var(--color-primary);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }
        .banner-date {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: var(--text-xs);
          color: var(--text-muted);
        }
        .banner-title {
          font-size: var(--text-xl);
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.01em;
          margin: 0;
          line-height: 1.3;
        }
        .banner-excerpt {
          font-size: var(--text-sm);
          color: var(--text-secondary);
          line-height: 1.6;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .banner-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: var(--space-2);
          flex-wrap: wrap;
          gap: var(--space-3);
        }
        .banner-author {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .author-circle {
          width: 24px;
          height: 24px;
          border-radius: var(--radius-full);
          background: var(--bg-input);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-primary);
        }
        .author-name {
          font-size: var(--text-xs);
          color: var(--text-secondary);
          font-weight: 500;
        }
        .read-more-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: var(--radius-md);
          background: var(--color-primary);
          color: var(--text-on-primary, #ffffff);
          font-size: var(--text-xs);
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
          min-height: 40px;
          -webkit-tap-highlight-color: transparent;
        }
        .read-more-btn:hover {
          background: var(--color-primary-hover);
          transform: translateX(2px);
          box-shadow: var(--shadow-glow);
        }
        .read-more-btn:active {
          transform: scale(0.97);
        }

        @media (max-width: 640px) {
          .banner-content {
            padding: var(--space-4);
          }
          .banner-title {
            font-size: var(--text-lg);
          }
          .banner-footer {
            flex-direction: column;
            align-items: stretch;
          }
          .read-more-btn {
            justify-content: center;
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
