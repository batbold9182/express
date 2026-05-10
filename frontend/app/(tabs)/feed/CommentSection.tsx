import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Icon } from '../../components';
import { C, R } from '../../theme';
import { api } from '../../lib/api';
import type { Comment } from './types';

function CommentRow({ comment, reviewId, token, myId, onUpdate }: {
  comment: Comment; reviewId: string; token: string; myId: string;
  onUpdate: (comments: Comment[]) => void;
}) {
  const [count, setCount]           = useState(comment.likes?.length ?? 0);
  const [liked, setLiked]           = useState((comment.likes ?? []).includes(myId));
  const [editing, setEditing]       = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [editText, setEditText]     = useState(comment.text);
  const [busy, setBusy]             = useState(false);
  const isOwn = comment.userId?._id?.toString() === myId;

  async function toggleLike() {
    if (busy) return;
    setBusy(true);
    try {
      if (liked) {
        const res = await api.del(`/reviews/${reviewId}/comments/${comment._id}/like`, token);
        setCount(res.likes); setLiked(false);
      } else {
        const res = await api.post(`/reviews/${reviewId}/comments/${comment._id}/like`, token, {});
        setCount(res.likes); setLiked(true);
      }
    } catch {} finally { setBusy(false); }
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

  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
      {comment.userId?.avatarUrl
        ? <Image source={{ uri: comment.userId.avatarUrl }} style={s.commentAvatar} />
        : <View style={[s.commentAvatar, { backgroundColor: C.glass }]} />}
      <View style={{ flex: 1 }}>
        <Text style={s.commentName}>{comment.userId?.displayName}</Text>
        {editing ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <TextInput
              value={editText}
              onChangeText={setEditText}
              style={{ flex: 1, fontSize: 12, color: C.fg, borderBottomWidth: 1, borderBottomColor: C.violet }}
              autoFocus
            />
            <TouchableOpacity onPress={saveEdit} activeOpacity={0.7}>
              <Text style={{ fontSize: 13, color: C.violet }}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setEditing(false); setShowActions(false); }} activeOpacity={0.7}>
              <Icon name="x" size={14} color={C.fg3} />
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={s.commentText}>{editText}</Text>
        )}
        {isOwn && showActions && !editing && (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
            <TouchableOpacity onPress={() => setEditing(true)} activeOpacity={0.7}>
              <Text style={{ fontSize: 11, color: C.violet }}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={deleteComment} activeOpacity={0.7}>
              <Text style={{ fontSize: 11, color: C.pink }}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowActions(false)} activeOpacity={0.7}>
              <Text style={{ fontSize: 11, color: C.fg3 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <TouchableOpacity onPress={toggleLike} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Icon name="heart" size={12} color={liked ? C.pink : C.fg4} />
          {count > 0 && <Text style={{ fontSize: 10, color: liked ? C.pink : C.fg4 }}>{count}</Text>}
        </TouchableOpacity>
        {isOwn && !showActions && (
          <TouchableOpacity onPress={() => setShowActions(true)} activeOpacity={0.7}>
            <Icon name="more" size={14} color={C.fg3} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

type Props = { reviewId: string; initial: Comment[]; token: string; myId: string };

export function CommentSection({ reviewId, initial, token, myId }: Props) {
  const [comments, setComments] = useState<Comment[]>(initial ?? []);
  const [open, setOpen]         = useState(false);
  const [text, setText]         = useState('');
  const [posting, setPosting]   = useState(false);

  async function submit() {
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      const updated = await api.post(`/reviews/${reviewId}/comments`, token, { text });
      setComments(updated);
      setText('');
    } catch {} finally { setPosting(false); }
  }

  return (
    <View>
      <TouchableOpacity onPress={() => setOpen(v => !v)} activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 4 }}>
        <Icon name="comment" size={14} color={C.fg3} />
        <Text style={{ fontSize: 11, color: C.fg3 }}>
          {comments.length > 0 ? `${comments.length} comment${comments.length > 1 ? 's' : ''}` : 'Comment'}
        </Text>
      </TouchableOpacity>

      {open && (
        <View style={{ marginTop: 8, gap: 8 }}>
          {comments.map(c => (
            <CommentRow key={c._id} comment={c} reviewId={reviewId} token={token} myId={myId} onUpdate={setComments} />
          ))}
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={s.commentInput}>
              <TextInput
                value={text}
                onChangeText={t => setText(t.slice(0, 280))}
                placeholder="Add a comment…"
                placeholderTextColor={C.fg3}
                style={{ flex: 1, fontSize: 13, color: C.fg }}
                returnKeyType="send"
                onSubmitEditing={submit}
              />
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
  commentAvatar: { width: 22, height: 22, borderRadius: 11 },
  commentName:   { fontSize: 11, fontWeight: '600', color: C.fg },
  commentText:   { fontSize: 12, color: C.fg2, lineHeight: 17, marginTop: 1 },
  commentInput:  {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.glass, borderRadius: R.r2, borderWidth: 1,
    borderColor: C.stroke, paddingHorizontal: 10, paddingVertical: 6,
  },
});
