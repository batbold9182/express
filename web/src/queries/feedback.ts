import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { asArray } from './asArray';
import { qk } from './keys';

type FeedbackItem = {
  _id: string;
  displayName: string;
  email: string;
  type: 'bug' | 'feature' | 'other';
  text: string;
  createdAt: string;
};

/** The admin's feedback inbox. A 403 (not an admin) is not retried; the page words it as "Only for admin". */
export function useFeedbackList() {
  return useQuery({
    queryKey: qk.feedback(),
    queryFn: async ({ signal }) => asArray<FeedbackItem>(await api.get('/feedback', signal)),
  });
}
