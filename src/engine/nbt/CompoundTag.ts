/**
 * Translation of: nbt/Tag.h — verbatim
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/nbt/Tag.h
 *
 * NBT (Named Binary Tag) is Minecraft's serialization format.
 * Tag is the abstract base class; CompoundTag and ListTag are the
 * container types used by Entity::save/load + LevelData.
 *
 * Constants from Tag.h:
 *   TAG_End=0, TAG_Byte=1, TAG_Short=2, TAG_Int=3, TAG_Long=4,
 *   TAG_Float=5, TAG_Double=6, TAG_Byte_Array=7, TAG_String=8,
 *   TAG_List=9, TAG_Compound=10
 */

export const TagType = {
  TAG_End: 0,
  TAG_Byte: 1,
  TAG_Short: 2,
  TAG_Int: 3,
  TAG_Long: 4,
  TAG_Float: 5,
  TAG_Double: 6,
  TAG_Byte_Array: 7,
  TAG_String: 8,
  TAG_List: 9,
  TAG_Compound: 10,
} as const;

export abstract class Tag {
  errorState = 0;
  static readonly TAGERR_OUT_OF_BOUNDS = 1;
  static readonly TAGERR_BAD_TYPE = 2;
  protected name: string;

  constructor(name: string) { this.name = name; }

  abstract write(dos: { writeByte(b: number): void; writeShort(s: number): void; writeInt(i: number): void; writeFloat(f: number): void; writeUTF(s: string): void }): void;
  abstract load(dis: { readByte(): number; readShort(): number; readInt(): number; readFloat(): number; readUTF(): string }): void;
  abstract toString(): string;
  abstract getId(): number;
  abstract copy(): Tag;

  setName(name: string): Tag { this.name = name; return this; }
  getName(): string { return this.name; }

  static getTagName(type: number): string {
    const names = ['TAG_End', 'TAG_Byte', 'TAG_Short', 'TAG_Int', 'TAG_Long', 'TAG_Float', 'TAG_Double', 'TAG_Byte_Array', 'TAG_String', 'TAG_List', 'TAG_Compound'];
    return names[type] ?? 'UNKNOWN';
  }

  static newTag(type: number, name: string): Tag | null {
    switch (type) {
      case TagType.TAG_Byte: return new ByteTag(name, 0);
      case TagType.TAG_Short: return new ShortTag(name, 0);
      case TagType.TAG_Int: return new IntTag(name, 0);
      case TagType.TAG_Long: return new LongTag(name, 0);
      case TagType.TAG_Float: return new FloatTag(name, 0);
      case TagType.TAG_Double: return new DoubleTag(name, 0);
      case TagType.TAG_String: return new StringTag(name, '');
      case TagType.TAG_List: return new ListTag(name);
      case TagType.TAG_Compound: return new CompoundTag(name);
      default: return null;
    }
  }

  static readNamedTag(dis: { readByte(): number; readShort(): number; readInt(): number; readFloat(): number; readUTF(): string }): Tag | null {
    const type = dis.readByte();
    if (type === TagType.TAG_End) return new EndTag();
    const name = dis.readUTF();
    const tag = Tag.newTag(type, name);
    if (tag) tag.load(dis);
    return tag;
  }

  static writeNamedTag(tag: Tag, dos: { writeByte(b: number): void; writeShort(s: number): void; writeInt(i: number): void; writeFloat(f: number): void; writeUTF(s: string): void }): void {
    dos.writeByte(tag.getId());
    if (tag.getId() === TagType.TAG_End) return;
    dos.writeUTF(tag.getName());
    tag.write(dos);
  }
}

export class EndTag extends Tag {
  constructor() { super(''); }
  write(_dos: unknown): void {}
  load(_dis: unknown): void {}
  toString(): string { return 'TAG_End'; }
  getId(): number { return TagType.TAG_End; }
  copy(): Tag { return new EndTag(); }
}

export class ByteTag extends Tag {
  data: number;
  constructor(name: string, data: number) { super(name); this.data = data; }
  write(dos: { writeByte(b: number): void }): void { dos.writeByte(this.data); }
  load(dis: { readByte(): number }): void { this.data = dis.readByte(); }
  toString(): string { return `TAG_Byte(${this.name}): ${this.data}`; }
  getId(): number { return TagType.TAG_Byte; }
  copy(): Tag { return new ByteTag(this.name, this.data); }
}

export class ShortTag extends Tag {
  data: number;
  constructor(name: string, data: number) { super(name); this.data = data; }
  write(dos: { writeShort(s: number): void }): void { dos.writeShort(this.data); }
  load(dis: { readShort(): number }): void { this.data = dis.readShort(); }
  toString(): string { return `TAG_Short(${this.name}): ${this.data}`; }
  getId(): number { return TagType.TAG_Short; }
  copy(): Tag { return new ShortTag(this.name, this.data); }
}

export class IntTag extends Tag {
  data: number;
  constructor(name: string, data: number) { super(name); this.data = data; }
  write(dos: { writeInt(i: number): void }): void { dos.writeInt(this.data); }
  load(dis: { readInt(): number }): void { this.data = dis.readInt(); }
  toString(): string { return `TAG_Int(${this.name}): ${this.data}`; }
  getId(): number { return TagType.TAG_Int; }
  copy(): Tag { return new IntTag(this.name, this.data); }
}

export class LongTag extends Tag {
  data: number;
  constructor(name: string, data: number) { super(name); this.data = data; }
  write(dos: { writeInt(i: number): void }): void { dos.writeInt(this.data); }
  load(dis: { readInt(): number }): void { this.data = dis.readInt(); }
  toString(): string { return `TAG_Long(${this.name}): ${this.data}`; }
  getId(): number { return TagType.TAG_Long; }
  copy(): Tag { return new LongTag(this.name, this.data); }
}

export class FloatTag extends Tag {
  data: number;
  constructor(name: string, data: number) { super(name); this.data = data; }
  write(dos: { writeFloat(f: number): void }): void { dos.writeFloat(this.data); }
  load(dis: { readFloat(): number }): void { this.data = dis.readFloat(); }
  toString(): string { return `TAG_Float(${this.name}): ${this.data}`; }
  getId(): number { return TagType.TAG_Float; }
  copy(): Tag { return new FloatTag(this.name, this.data); }
}

export class DoubleTag extends Tag {
  data: number;
  constructor(name: string, data: number) { super(name); this.data = data; }
  write(dos: { writeFloat(f: number): void }): void { dos.writeFloat(this.data); }
  load(dis: { readFloat(): number }): void { this.data = dis.readFloat(); }
  toString(): string { return `TAG_Double(${this.name}): ${this.data}`; }
  getId(): number { return TagType.TAG_Double; }
  copy(): Tag { return new DoubleTag(this.name, this.data); }
}

export class StringTag extends Tag {
  data: string;
  constructor(name: string, data: string) { super(name); this.data = data; }
  write(dos: { writeUTF(s: string): void }): void { dos.writeUTF(this.data); }
  load(dis: { readUTF(): string }): void { this.data = dis.readUTF(); }
  toString(): string { return `TAG_String(${this.name}): ${this.data}`; }
  getId(): number { return TagType.TAG_String; }
  copy(): Tag { return new StringTag(this.name, this.data); }
}

export class ListTag extends Tag {
  private list: Tag[] = [];
  private type: number = TagType.TAG_Byte;

  constructor(name: string = '') { super(name); }

  write(dos: { writeByte(b: number): void; writeInt(i: number): void }): void {
    if (this.list.length > 0) this.type = this.list[0].getId();
    else this.type = TagType.TAG_Byte;
    dos.writeByte(this.type);
    dos.writeInt(this.list.length);
    for (const tag of this.list) tag.write(dos);
  }

  load(dis: { readByte(): number; readInt(): number; readShort(): number; readFloat(): number; readUTF(): string }): void {
    this.type = dis.readByte();
    const size = dis.readInt();
    this.list = [];
    for (let i = 0; i < size; i++) {
      const tag = Tag.newTag(this.type, '');
      if (tag) { tag.load(dis); this.list.push(tag); }
    }
  }

  getId(): number { return TagType.TAG_List; }
  toString(): string { return `${this.list.length} entries of type ${Tag.getTagName(this.type)}`; }

  add(tag: Tag): void { this.type = tag.getId(); this.list.push(tag); }

  get(index: number): Tag | null {
    if (index >= this.size()) { this.errorState |= Tag.TAGERR_OUT_OF_BOUNDS; return null; }
    return this.list[index];
  }

  getFloat(index: number): number {
    const tag = this.get(index);
    if (!tag) return 0;
    if (tag.getId() !== TagType.TAG_Float) { this.errorState |= Tag.TAGERR_BAD_TYPE; return 0; }
    return (tag as FloatTag).data;
  }

  size(): number { return this.list.length; }

  copy(): Tag {
    const res = new ListTag(this.name);
    res.type = this.type;
    for (const tag of this.list) res.list.push(tag.copy());
    return res;
  }
}

// ListTagFloatAdder helper — verbatim from ListTag.h
export class ListTagFloatAdder {
  tag: ListTag | null = null;
  constructor(f?: number) {
    if (f !== undefined) {
      this.tag = new ListTag();
      this.tag.add(new FloatTag('', f));
    }
  }
  operator(): this { return this; }
  addFloat(name: string, f: number): this {
    if (!this.tag) this.tag = new ListTag();
    this.tag.add(new FloatTag(name, f));
    return this;
  }
  addFloatAnon(f: number): this { return this.addFloat('', f); }
}

export class CompoundTag extends Tag {
  private tags: Map<string, Tag> = new Map();

  constructor(name: string = '') { super(name); }

  write(dos: { writeByte(b: number): void; writeShort(s: number): void; writeInt(i: number): void; writeFloat(f: number): void; writeUTF(s: string): void }): void {
    for (const [, tag] of this.tags) Tag.writeNamedTag(tag, dos);
    dos.writeByte(TagType.TAG_End);
  }

  load(dis: { readByte(): number; readShort(): number; readInt(): number; readFloat(): number; readUTF(): string }): void {
    this.tags.clear();
    let tag: Tag | null = Tag.readNamedTag(dis);
    while (tag && tag.getId() !== TagType.TAG_End) {
      this.tags.set(tag.getName(), tag);
      tag = Tag.readNamedTag(dis);
    }
  }

  getId(): number { return TagType.TAG_Compound; }
  toString(): string { return `${this.tags.size} entries`; }

  // CompoundTag put methods — verbatim
  put(name: string, tag: Tag): void { this.tags.set(name, tag.setName(name)); }
  putByte(name: string, value: number): void { this.tags.set(name, new ByteTag(name, value)); }
  putShort(name: string, value: number): void { this.tags.set(name, new ShortTag(name, value)); }
  putInt(name: string, value: number): void { this.tags.set(name, new IntTag(name, value)); }
  putLong(name: string, value: number): void { this.tags.set(name, new LongTag(name, value)); }
  putFloat(name: string, value: number): void { this.tags.set(name, new FloatTag(name, value)); }
  putDouble(name: string, value: number): void { this.tags.set(name, new DoubleTag(name, value)); }
  putString(name: string, value: string): void { this.tags.set(name, new StringTag(name, value)); }
  putCompound(name: string, value: CompoundTag): void { this.tags.set(name, value.setName(name)); }
  putBoolean(name: string, val: boolean): void { this.putByte(name, val ? 1 : 0); }

  // CompoundTag get methods — verbatim
  get(name: string): Tag | null { return this.tags.get(name) ?? null; }
  contains(name: string, type?: number): boolean {
    const tag = this.tags.get(name);
    if (!tag) return false;
    if (type !== undefined && tag.getId() !== type) return false;
    return true;
  }
  getByte(name: string): number {
    if (!this.contains(name, TagType.TAG_Byte)) return 0;
    return (this.get(name) as ByteTag).data;
  }
  getShort(name: string): number {
    if (!this.contains(name, TagType.TAG_Short)) return 0;
    return (this.get(name) as ShortTag).data;
  }
  getInt(name: string): number {
    if (!this.contains(name, TagType.TAG_Int)) return 0;
    return (this.get(name) as IntTag).data;
  }
  getLong(name: string): number {
    if (!this.contains(name, TagType.TAG_Long)) return 0;
    return (this.get(name) as LongTag).data;
  }
  getFloat(name: string): number {
    if (!this.contains(name, TagType.TAG_Float)) return 0;
    return (this.get(name) as FloatTag).data;
  }
  getDouble(name: string): number {
    if (!this.contains(name, TagType.TAG_Double)) return 0;
    return (this.get(name) as DoubleTag).data;
  }
  getString(name: string): string {
    if (!this.contains(name, TagType.TAG_String)) return '';
    return (this.get(name) as StringTag).data;
  }
  getCompound(name: string): CompoundTag {
    if (!this.contains(name, TagType.TAG_Compound)) return new CompoundTag(name);
    return this.get(name) as CompoundTag;
  }
  getList(name: string): ListTag {
    if (!this.contains(name, TagType.TAG_List)) return new ListTag(name);
    return this.get(name) as ListTag;
  }
  getBoolean(name: string): boolean { return this.getByte(name) !== 0; }

  isEmpty(): boolean { return this.tags.size === 0; }
  copy(): Tag {
    const tag = new CompoundTag(this.name);
    for (const [key, value] of this.tags) tag.tags.set(key, value.copy());
    return tag;
  }
  deleteChildren(): void {
    for (const [, tag] of this.tags) {
      (tag as CompoundTag).deleteChildren?.();
    }
    this.tags.clear();
  }
}
