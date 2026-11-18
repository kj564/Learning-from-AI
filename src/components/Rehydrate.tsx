'use client';
import { useEffect } from 'react';
import { useStore } from '@/lib/store';

export default function Rehydrate() {
  useEffect(() => { useStore.persist.rehydrate(); }, []);
  return null;
}
