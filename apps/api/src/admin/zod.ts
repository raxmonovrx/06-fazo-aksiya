import { BadRequestException } from '@nestjs/common';
import type { z } from 'zod';

/** Body/query'ni zod bilan tekshiradi; xato bo'lsa 400 va tushunarli matn. */
export function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const res = schema.safeParse(value);
  if (!res.success) {
    throw new BadRequestException({
      message: res.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '),
    });
  }
  return res.data;
}
