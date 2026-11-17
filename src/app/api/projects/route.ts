/**
 * API: /api/projects — Project + Document CRUD (now persisted via Prisma)
 *
 * Each project = { id, name, description, instructions, documents[] }
 *
 * Actions (POST body):
 *   - create:    { action:'create', name, description? }
 *   - get:       { action:'get', id }
 *   - update:    { action:'update', id, name?, description?, instructions? }
 *   - delete:    { action:'delete', id }
 *   - addDocument:    { action:'addDocument', id, documentName, documentType, documentContent, documentLanguage? }
 *   - updateDocument: { action:'updateDocument', id, documentId, documentName?, documentType?, documentContent?, documentLanguage? }
 *   - deleteDocument: { action:'deleteDocument', id, documentId }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export interface DocumentDTO {
  id: string;
  name: string;
  type: 'code' | 'text' | 'instruction' | 'config';
  content: string;
  language?: string | null;
  updatedAt: number;
}

export interface ProjectDTO {
  id: string;
  name: string;
  description: string;
  documents: DocumentDTO[];
  instructions: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectListItem {
  id: string;
  name: string;
  description: string;
  documentCount: number;
  createdAt: number;
  updatedAt: number;
}

function docToDTO(d: {
  id: string;
  name: string;
  type: string;
  content: string;
  language: string | null;
  updatedAt: Date;
}): DocumentDTO {
  return {
    id: d.id,
    name: d.name,
    type: d.type as DocumentDTO['type'],
    content: d.content,
    language: d.language,
    updatedAt: d.updatedAt.getTime(),
  };
}

function projToDTO(p: {
  id: string;
  name: string;
  description: string;
  instructions: string;
  createdAt: Date;
  updatedAt: Date;
  documents: ReturnType<typeof docToDTO extends (x: infer T) => any ? () => T[] : never>[] | any[];
}): ProjectDTO {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    instructions: p.instructions,
    documents: (p.documents || []).map(docToDTO),
    createdAt: p.createdAt.getTime(),
    updatedAt: p.updatedAt.getTime(),
  };
}

export async function GET() {
  const list = await db.project.findMany({
    include: { documents: true },
    orderBy: { updatedAt: 'desc' },
  });
  const items: ProjectListItem[] = list.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    documentCount: p.documents.length,
    createdAt: p.createdAt.getTime(),
    updatedAt: p.updatedAt.getTime(),
  }));
  return NextResponse.json({ projects: items });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    action,
    id,
    name,
    description,
    instructions,
    documentId,
    documentName,
    documentType,
    documentContent,
    documentLanguage,
  } = body;

  switch (action) {
    case 'create': {
      const p = await db.project.create({
        data: {
          name: name || 'Untitled Project',
          description: description || '',
          instructions: instructions || '',
        },
      });
      return NextResponse.json({ success: true, project: projToDTO({ ...p, documents: [] }) });
    }

    case 'get': {
      if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
      const p = await db.project.findUnique({ where: { id }, include: { documents: true } });
      if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ project: projToDTO(p) });
    }

    case 'update': {
      if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
      const existing = await db.project.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const data: Record<string, string> = {};
      if (name !== undefined) data.name = name;
      if (description !== undefined) data.description = description;
      if (instructions !== undefined) data.instructions = instructions;
      const p = await db.project.update({ where: { id }, data, include: { documents: true } });
      return NextResponse.json({ success: true, project: projToDTO(p) });
    }

    case 'delete': {
      if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
      try {
        await db.project.delete({ where: { id } });
        return NextResponse.json({ success: true });
      } catch {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    case 'addDocument': {
      if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
      const p = await db.project.findUnique({ where: { id } });
      if (!p) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      const doc = await db.document.create({
        data: {
          projectId: id,
          name: documentName || 'untitled',
          type: (documentType as string) || 'text',
          content: documentContent || '',
          language: documentLanguage || null,
        },
      });
      return NextResponse.json({ success: true, document: docToDTO(doc) });
    }

    case 'updateDocument': {
      if (!id || !documentId) return NextResponse.json({ error: 'ID + documentId required' }, { status: 400 });
      const existing = await db.document.findUnique({ where: { id: documentId } });
      if (!existing || existing.projectId !== id) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      }
      const data: Record<string, string | null> = {};
      if (documentName !== undefined) data.name = documentName;
      if (documentType !== undefined) data.type = documentType;
      if (documentContent !== undefined) data.content = documentContent;
      if (documentLanguage !== undefined) data.language = documentLanguage || null;
      const doc = await db.document.update({ where: { id: documentId }, data });
      return NextResponse.json({ success: true, document: docToDTO(doc) });
    }

    case 'deleteDocument': {
      if (!id || !documentId) return NextResponse.json({ error: 'ID + documentId required' }, { status: 400 });
      const existing = await db.document.findUnique({ where: { id: documentId } });
      if (!existing || existing.projectId !== id) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      }
      await db.document.delete({ where: { id: documentId } });
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
