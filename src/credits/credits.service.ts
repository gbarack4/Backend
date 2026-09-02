import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, gte, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '@/database/schema';
import { DB_CONNECTION } from '@/database/database.module';
import type { FullSchema } from '@/database/database.types';
import type { DatabaseTransaction } from '@/database/types/database-transaction.type';

import { AddCreditInput } from './interface/add-credit-input.interface';
import { UseCreditInput } from './interface/use-credit-input.interface';

@Injectable()
export class CreditsService {
  constructor(
    @Inject(DB_CONNECTION)
    private readonly db: NodePgDatabase<FullSchema>,
  ) {}

  async getBalance(schoolId: string, studentId: string): Promise<number> {
    const balance = await this.db.query.studentCreditBalances.findFirst({
      where: and(
        eq(schema.studentCreditBalances.schoolId, schoolId),
        eq(schema.studentCreditBalances.studentId, studentId),
      ),
    });

    return balance?.balanceMinutes ?? 0;
  }

  async addCredit(input: AddCreditInput): Promise<number> {
    return this.db.transaction((tx) => this.addCreditInTransaction(tx, input));
  }

  async addCreditInTransaction(tx: DatabaseTransaction, input: AddCreditInput): Promise<number> {
    this.validateMinutes(input.minutes);

    const [transaction] = await tx
      .insert(schema.studentCreditTransactions)
      .values({
        schoolId: input.schoolId,
        studentId: input.studentId,
        packagePurchaseId: input.packagePurchaseId ?? null,
        bookingId: input.bookingId ?? null,
        type: input.type,
        deltaMinutes: input.minutes,
        idempotencyKey: input.idempotencyKey,
      })
      .onConflictDoNothing({
        target: schema.studentCreditTransactions.idempotencyKey,
      })
      .returning({
        id: schema.studentCreditTransactions.id,
      });

    if (!transaction) {
      const balance = await tx.query.studentCreditBalances.findFirst({
        where: and(
          eq(schema.studentCreditBalances.schoolId, input.schoolId),
          eq(schema.studentCreditBalances.studentId, input.studentId),
        ),
      });

      return balance?.balanceMinutes ?? 0;
    }

    const [balance] = await tx
      .insert(schema.studentCreditBalances)
      .values({
        schoolId: input.schoolId,
        studentId: input.studentId,
        balanceMinutes: input.minutes,
      })
      .onConflictDoUpdate({
        target: [schema.studentCreditBalances.schoolId, schema.studentCreditBalances.studentId],
        set: {
          balanceMinutes: sql`${schema.studentCreditBalances.balanceMinutes} + ${input.minutes}`,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning({
        balanceMinutes: schema.studentCreditBalances.balanceMinutes,
      });

    return balance.balanceMinutes;
  }

  async useCredit(input: UseCreditInput): Promise<number> {
    return this.db.transaction((tx) => this.useCreditInTransaction(tx, input));
  }

  async useCreditInTransaction(tx: DatabaseTransaction, input: UseCreditInput): Promise<number> {
    this.validateMinutes(input.minutes);

    const [transaction] = await tx
      .insert(schema.studentCreditTransactions)
      .values({
        schoolId: input.schoolId,
        studentId: input.studentId,
        bookingId: input.bookingId,
        type: 'booking_use',
        deltaMinutes: -input.minutes,
        idempotencyKey: input.idempotencyKey,
      })
      .onConflictDoNothing({
        target: schema.studentCreditTransactions.idempotencyKey,
      })
      .returning({
        id: schema.studentCreditTransactions.id,
      });

    if (!transaction) {
      const balance = await tx.query.studentCreditBalances.findFirst({
        where: and(
          eq(schema.studentCreditBalances.schoolId, input.schoolId),
          eq(schema.studentCreditBalances.studentId, input.studentId),
        ),
      });

      return balance?.balanceMinutes ?? 0;
    }

    const [balance] = await tx
      .update(schema.studentCreditBalances)
      .set({
        balanceMinutes: sql`${schema.studentCreditBalances.balanceMinutes} - ${input.minutes}`,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(schema.studentCreditBalances.schoolId, input.schoolId),
          eq(schema.studentCreditBalances.studentId, input.studentId),
          gte(schema.studentCreditBalances.balanceMinutes, input.minutes),
        ),
      )
      .returning({
        balanceMinutes: schema.studentCreditBalances.balanceMinutes,
      });

    if (!balance) {
      throw new BadRequestException('Insufficient credit balance');
    }

    return balance.balanceMinutes;
  }

  private validateMinutes(minutes: number): void {
    if (!Number.isInteger(minutes) || minutes <= 0) {
      throw new BadRequestException('Credit minutes must be a positive integer');
    }
  }

  async getStudentBalance(userId: string, schoolId: string) {
    const student = await this.db.query.students.findFirst({
      columns: {
        id: true,
      },
      where: and(eq(schema.students.userId, userId), eq(schema.students.schoolId, schoolId)),
    });

    if (!student) {
      throw new NotFoundException('Student not found for this school');
    }

    const balanceMinutes = await this.getBalance(schoolId, student.id);

    return {
      balanceMinutes,
    };
  }
}
