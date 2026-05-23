import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Avatar, Icon } from '../../components';
import { C, R } from '../../theme';
import { api } from '../../lib/api';
import type { Comment } from './types';

// ── Single comment row ────────────────────────────────────────────────────────
function CommentRow({ comment, reviewId, token, myId, isReply = false, onUpdate, onReply }: {
  comment: Comment;
  reviewId: string;
  token: string;
  myId: string;
  isReply?: boolean;
  onUpdate: (comments: Comment[]) => void;
  onReply: (comment: Comment) => void;
}) {
  const [count, setCount]             = useState(comment.likes?.length ?? 0);
  const [liked, setLiked]             = useState((comment.likes ?? []).includes(myId));
  const [editing, setEditing]         = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [editText, setEditText]       = useState(comment.text);
  const [busy, setBusy]               = useState(false);
  const isOwn = comment.userId?._id?.toString() === myId;

  async function toggleLike() {
    if (busy) return;
    setBusy(true);
    const next = !liked;
    setLiked(next);
    setCount(c => next ? c + 1 : c - 1);
    try {
      if (next) {
        const res = await api.post(`/reviews/${reviewId}/comments/${comment._id}/like`, token, {});
        setCount(res.likes);
      } else {
        const res = await api.del(`/reviews/${reviewId}/comments/${comment._id}/like`, token);
        setCount(res.likes);
      }
    } catch {
      setLiked(!next);
      setCount(c => next ? c - 1 : c + 1);
    } finally { setBusy(false); }
  }

  async function saveEdit() {
    if (!editText.trim() || busy) return;
    setBusy(true);
    try {
      const updated = await api.put(`/reviews/${reviewId}/comments/${comment._id}`, token, { text: editText });
      onUpdate(updated);
      setEditing(false);
      setShowActions(false);
    } catch {} finally { setBusy(false); }
  }

  async function deleteComment() {
    try {
      const updated = await api.del(`/reviews/${reviewId}/comments/${comment._id}`, token);
      onUpdate(updated);
    } catch {}
  }

  const avatarSize = isReply ? 22 : 28;

  return (
    <View style={[s.row, isReply && s.replyRow]}>
      {comment.userId?.avatarUrl
        ? <Image source={{ uri: comment.userId.avatarUrl }} style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }} />
        : <Avatar name={comment.userId?.displayName || '?'} size={avatarSize} />}

      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[s.name, isReply && s.replyName]}>{comment.userId?.displayName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity onPress={toggleLike} activeOpacity={0.7} style={s.likeBtn}>
              <Icon name="heart" size={12} color={liked ? C.pink : C.fg4} fill={liked ? C.pink : 'none'} />
              {count > 0 && <Text style={{ fontSize: 11, color: liked ? C.pink : C.fg4 }}>{count}</Text>}
            </TouchableOpacity>
            {isOwn && !showActions && !editing && (
              <TouchableOpacity onPress={() => setShowActions(true)} activeOpacity={0.7}>
                <Icon name="more" size={13} color={C.fg4} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {editing ? (
          <View style={s.editRow}>
            <TextInput
              value={editText}
              onChangeText={setEditText}
              style={{ flex: 1, fontSize: 13, color: C.fg }}
              autoFocus
            />
            <TouchableOpacity onPress={saveEdit} activeOpacity={0.7}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: C.violet }}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setEditing(false); setShowActions(false); }} activeOpacity={0.7}>
              <Icon name="x" size={13} color={C.fg3} />
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={[s.text, isReply && s.replyText]}>{editText}</Text>
        )}

        {isOwn && showActions && !editing ? (
          <View style={s.actionsMenu}>
            <TouchableOpacity onPress={() => setEditing(true)} activeOpacity={0.7} style={s.actionItem}>
              <Icon name="edit" size={12} color={C.violet} />
              <Text style={[s.actionTxt, { color: C.violet }]}>Edit</Text>
            </TouchableOpacity>
            <View style={s.actionDivider} />
            <TouchableOpacity onPress={deleteComment} activeOpacity={0.7} style={s.actionItem}>
              <Icon name="x" size={12} color={C.pink} />
              <Text style={[s.actionTxt, { color: C.pink }]}>Delete</Text>
            </TouchableOpacity>
            <View style={s.actionDivider} />
            <TouchableOpacity onPress={() => setShowActions(false)} activeOpacity={0.7} style={s.actionItem}>
              <Text style={[s.actionTxt, { color: C.fg3 }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : !editing && !isOwn && (
          <TouchableOpacity onPress={() => { Haptics.selectionAsync(); onReply(comment); }} activeOpacity={0.7} style={s.replyBtn}>
            <Text style={s.replyBtnTxt}>Reply</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Thread: parent comment + its replies ──────────────────────────────────────
function CommentThread({ comment, replies, reviewId, token, myId, onUpdate, onReply }: {
  comment: Comment;
  replies: Comment[];
  reviewId: string;
  token: string;
  myId: string;
  onUpdate: (comments: Comment[]) => void;
  onReply: (comment: Comment) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View>
      <CommentRow
        comment={comment}
        reviewId={reviewId}
        token={token}
        myId={myId}
        onUpdate={onUpdate}
        onReply={onReply}
      />

      {replies.length > 0 && (
        <View style={s.repliesWrap}>
          {/* Expand / collapse toggle */}
          {!expanded ? (
            <TouchableOpacity onPress={() => setExpanded(true)} activeOpacity={0.7} style={s.viewRepliesBtn}>
              <View style={s.threadLine} />
              <Text style={s.viewRepliesTxt}>
                View {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ gap: 0 }}>
              <TouchableOpacity onPress={() => setExpanded(false)} activeOpacity={0.7} style={[s.viewRepliesBtn, { marginBottom: 4 }]}>
                <View style={s.threadLine} />
                <Text style={s.viewRepliesTxt}>Hide replies</Text>
              </TouchableOpacity>
              {replies.map(r => (
                <CommentRow
                  key={r._id}
                  comment={r}
                  reviewId={reviewId}
                  token={token}
                  myId={myId}
                  isReply
                  onUpdate={onUpdate}
                  onReply={onReply}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── Comment section ───────────────────────────────────────────────────────────
type Props = { reviewId: string; initial: Comment[]; token: string; myId: string };

export function CommentSection({ reviewId, initial, token, myId }: Props) {
  const [comments, setComments] = useState<Comment[]>(initial ?? []);
  const [open, setOpen]         = useState(false);
  const [text, setText]         = useState('');
  const [posting, setPosting]   = useState(false);
  const [replyingTo, setReplyingTo]   = useState<Comment | null>(null); // thread parent → used for parentId in API
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null); // who you tapped → used for display only
  const inputRef = useRef<TextInput>(null);

  // Group: top-level comments + their replies
  const topLevel = comments.filter(c => !c.parentId);
  const repliesFor = (id: string) => comments.filter(c => c.parentId === id);
  const totalCount = comments.length;

  function handleReply(comment: Comment) {
    // Thread stays 1 level deep — post parentId of the root comment
    const threadParent = comment.parentId
      ? comments.find(c => c._id === comment.parentId) ?? comment
      : comment;
    setReplyingTo(threadParent);
    // But show the name of the person you actually tapped Reply on
    setReplyTarget(comment);
    setText(`@${comment.userId.displayName} `);
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function cancelReply() {
    setReplyingTo(null);
    setReplyTarget(null);
    setText('');
  }

  async function submit() {
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      const body: any = { text: text.trim() };
      if (replyingTo) body.parentId = replyingTo._id;
      const updated = await api.post(`/reviews/${reviewId}/comments`, token, body);
      setComments(updated);
      setText('');
      setReplyingTo(null);
      setReplyTarget(null);
      // Auto-expand replies on the parent after posting a reply
      if (replyingTo) setOpen(true);
    } catch {} finally { setPosting(false); }
  }

  return (
    <View>
      {/* Toggle button */}
      <TouchableOpacity
        onPress={() => setOpen(v => !v)}
        activeOpacity={0.7}
        style={[s.toggle, open && s.toggleOpen]}
      >
        <Icon name="comment" size={14} color={open ? C.violet : C.fg3} />
        <Text style={[s.toggleTxt, open && { color: C.violet }]}>
          {totalCount > 0 ? `${totalCount} comment${totalCount > 1 ? 's' : ''}` : 'Comment'}
        </Text>
      </TouchableOpacity>

      {open && (
        <View style={{ marginTop: 12 }}>
          {/* Threaded comment list */}
          {topLevel.map((c, i) => (
            <View key={c._id}>
              {i > 0 && <View style={s.commentDivider} />}
              <CommentThread
                comment={c}
                replies={repliesFor(c._id)}
                reviewId={reviewId}
                token={token}
                myId={myId}
                onUpdate={setComments}
                onReply={handleReply}
              />
            </View>
          ))}

          {topLevel.length > 0 && <View style={s.commentDivider} />}

          {/* Reply-to banner */}
          {replyTarget && (
            <View style={s.replyBanner}>
              <Text style={s.replyBannerTxt}>
                Replying to <Text style={{ color: C.violet }}>@{replyTarget.userId.displayName}</Text>
              </Text>
              <TouchableOpacity onPress={cancelReply} activeOpacity={0.7}>
                <Icon name="x" size={14} color={C.fg3} />
              </TouchableOpacity>
            </View>
          )}

          {/* Input */}
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[s.input, replyTarget && s.inputReply]}>
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={t => setText(t.slice(0, 280))}
                placeholder={replyTarget ? `Reply to @${replyTarget.userId.displayName}…` : 'Add a comment…'}
                placeholderTextColor={C.fg3}
                style={{ flex: 1, fontSize: 13, color: C.fg }}
                returnKeyType="send"
                onSubmitEditing={submit}
              />
              {text.length > 200 && (
                <Text style={{ fontSize: 11, color: text.length > 260 ? C.red : C.fg4 }}>{280 - text.length}</Text>
              )}
              {posting
                ? <ActivityIndicator size="small" color={C.violet} />
                : <TouchableOpacity onPress={submit} activeOpacity={0.7}>
                    <Icon name="share" size={16} color={text.trim() ? C.violet : C.fg4} />
                  </TouchableOpacity>}
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row:      { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 8 },
  replyRow: { paddingVertical: 6 },
  name:     { fontSize: 12, fontWeight: '600', color: C.fg },
  replyName:{ fontSize: 11, fontWeight: '600', color: C.fg2 },
  text:     { fontSize: 13, color: C.fg2, lineHeight: 19 },
  replyText:{ fontSize: 12, color: C.fg2, lineHeight: 18 },

  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },

  replyBtn:    { alignSelf: 'flex-start', marginTop: 3 },
  replyBtnTxt: { fontSize: 11, fontWeight: '600', color: C.fg4, letterSpacing: 0.2 },

  repliesWrap: { marginLeft: 38 },

  viewRepliesBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  threadLine:     { width: 20, height: 1, backgroundColor: C.stroke },
  viewRepliesTxt: { fontSize: 12, fontWeight: '600', color: C.fg3 },

  editRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4,
    borderBottomWidth: 1, borderBottomColor: C.violet, paddingBottom: 4,
  },

  actionsMenu: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6,
    backgroundColor: C.glassThick, borderRadius: R.r2, borderWidth: 1,
    borderColor: C.stroke, paddingHorizontal: 10, paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  actionItem:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 3 },
  actionTxt:     { fontSize: 11, fontWeight: '500' },
  actionDivider: { width: 1, height: 10, backgroundColor: C.stroke },

  commentDivider: { height: 1, backgroundColor: C.stroke, marginVertical: 2 },

  replyBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(177,78,255,0.08)', borderRadius: R.r2,
    paddingHorizontal: 10, paddingVertical: 6, marginBottom: 4,
    borderWidth: 1, borderColor: 'rgba(177,78,255,0.2)',
  },
  replyBannerTxt: { fontSize: 12, color: C.fg3 },

  input: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.glass, borderRadius: R.r2, borderWidth: 1,
    borderColor: C.stroke, paddingHorizontal: 12, paddingVertical: 8,
    marginTop: 4,
  },
  inputReply: { borderColor: 'rgba(177,78,255,0.4)' },

  toggle:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: R.pill, backgroundColor: C.glassThin, alignSelf: 'flex-start' },
  toggleOpen: { backgroundColor: 'rgba(177,78,255,0.12)', },
  toggleTxt:  { fontSize: 12, fontWeight: '600', color: C.fg3 },
});
