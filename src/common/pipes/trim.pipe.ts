import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class TrimPipe implements PipeTransform<unknown, unknown> {
  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      (value.constructor === Object || Object.getPrototypeOf(value) === null)
    );
  }

  private trimValue(value: unknown): unknown {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.trimValue(item));
    }

    if (this.isPlainObject(value)) {
      const trimmedObject: Record<string, unknown> = {};
      for (const key of Object.keys(value)) {
        trimmedObject[key] = this.trimValue(value[key]);
      }
      return trimmedObject;
    }

    return value;
  }

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const { type } = metadata;

    if (type === 'body' || type === 'query' || type === 'param') {
      return this.trimValue(value);
    }

    return value;
  }
}
