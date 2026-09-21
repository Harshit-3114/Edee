'use client';

import { Check, Plus } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';

interface Props {
  courseName: string;
  shortlisted: boolean;
  pending: boolean;
  onToggle: () => void;
}

export default function ShortlistButton({
  courseName,
  shortlisted,
  pending,
  onToggle,
}: Props) {
  return (
    <Button
      size="sm"
      variant={shortlisted ? 'secondary' : 'primary'}
      loading={pending}
      onClick={onToggle}
      aria-pressed={shortlisted}
      // The visible label is short; screen readers get the course name too.
      aria-label={
        shortlisted
          ? `Remove ${courseName} from shortlist`
          : `Add ${courseName} to shortlist`
      }
    >
      {!pending &&
        (shortlisted ? (
          <Check size={14} weight="bold" />
        ) : (
          <Plus size={14} weight="bold" />
        ))}
      {shortlisted ? 'Shortlisted' : 'Shortlist'}
    </Button>
  );
}
