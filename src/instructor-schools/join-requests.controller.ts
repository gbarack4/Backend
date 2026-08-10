import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { InstructorSchoolsService } from './instructor-schools.service';
import { CreateJoinRequestDto } from './dto/create-join-request.dto';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserEntity } from '@/auth/interfaces/auth.interface';
import { RequireDbUserGuard } from '@/auth/guards/require-db-user.guard';

@Controller('join-requests')
@UseGuards(ClerkAuthGuard, RequireDbUserGuard)
export class JoinRequestsController {
  constructor(
    private readonly instructorSchoolsService: InstructorSchoolsService,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: UserEntity,
    @Body() dto: CreateJoinRequestDto,
  ) {
    return this.instructorSchoolsService.createJoinRequest(
      user.id,
      dto.schoolId,
    );
  }

  @Get('school/:schoolId')
  async findAllForSchool(
    @Param('schoolId', new ParseUUIDPipe({ version: '4' })) schoolId: string,
    @Query('status') status?: 'pending' | 'accepted' | 'rejected',
  ) {
    return this.instructorSchoolsService.findSchoolRequests(schoolId, status);
  }

  @Patch(':id/approve')
  async approve(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.instructorSchoolsService.updateRequestStatus(id, 'accepted');
  }

  @Patch(':id/decline')
  async decline(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.instructorSchoolsService.updateRequestStatus(id, 'rejected');
  }
}
