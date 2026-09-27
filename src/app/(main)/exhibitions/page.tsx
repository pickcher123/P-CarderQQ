'use client';

import React from 'react';
import { UnifiedEventCalendar } from '@/components/calendar/unified-event-calendar';

export default function ExhibitionsPage() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 text-white pb-24 pt-3 sm:pt-6">
      {/* Ambient Background Lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[450px] bg-gradient-to-b from-amber-500/15 via-purple-500/10 to-transparent blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-[600px] right-0 w-[600px] h-[600px] bg-amber-500/5 blur-[160px] pointer-events-none -z-10" />

      <div className="container mx-auto px-3 sm:px-6 max-w-7xl space-y-6">
        <UnifiedEventCalendar hideHeader={false} />
      </div>
    </div>
  );
}

