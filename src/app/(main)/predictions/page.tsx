'use client';

import React from 'react';
import { UnifiedEventCalendar } from '@/components/calendar/unified-event-calendar';

export default function PredictionsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24 pt-4 sm:pt-6">
      <div className="container mx-auto px-3 sm:px-6 max-w-6xl space-y-6">
        <UnifiedEventCalendar hideHeader={false} />
      </div>
    </div>
  );
}

