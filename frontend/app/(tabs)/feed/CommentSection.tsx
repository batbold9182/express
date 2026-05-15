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
    <View style={s.row}>
      {comment.userId?.avatarUrl
        ? <Image source={{ uri: comment.userId.avatarUrl }} style={s.avatar} />
        : <View style={[s.avatar, { backgroundColor: C.glass }]} />}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={s.name}>{comment.userId?.displayName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity onPress={toggleLike} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Icon name="heart" size={13} color={liked ? C.pink : C.fg4} fill={liked ? C.pink : 'none'} />
              {count > 0 && <Text style={{ fontSize: 11, color: liked ? C.pink : C.fg4 }}>{count}</Text>}
            </TouchableOpacity>
            {isOwn && !showActions && !editing && (
              <TouchableOpacity onPress={() => setShowActions(true)} activeOpacity={0.7}>
                <Icon name="more" size={14} color={C.fg3} />
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
          <Text style={s.text}>{editText}</Text>
        )}

        {isOwn && showActions && !editing && (
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
        style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Icon name="comment" size={14} color={open ? C.violet : C.fg3} />
        <Text style={{ fontSize: 12, color: open ? C.violet : C.fg3, fontWeight: '500' }}>
          {comments.length > 0 ? `${comments.length} comment${comments.length > 1 ? 's' : ''}` : 'Comment'}
        </Text>
      </TouchableOpacity>

      {open && (
        <View style={{ marginTop: 12, gap: 0 }}>
          {comments.map((c, i) => (
            <View key={c._id}>
              {i > 0 && <View style={s.commentDivider} />}
              <CommentRow comment={c} reviewId={reviewId} token={token} myId={myId} onUpdate={setComments} />
            </View>
          ))}
          {comments.length > 0 && <View style={s.commentDivider} />}
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={s.input}>
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
  row:    { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 10 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  name:   { fontSize: 12, fontWeight: '600', color: C.fg },
  text:   { fontSize: 13, color: C.fg2, lineHeight: 19 },

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

  input: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.glass, borderRadius: R.r2, borderWidth: 1,
    borderColor: C.stroke, paddingHorizontal: 12, paddingVertical: 8,
    marginTop: 4,
  },
});
