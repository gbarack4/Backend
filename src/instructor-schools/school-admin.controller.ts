import { ClerkAuthGuard } from '@/auth/guards/clerk-auth.guard';
import { RequireDbUserGuard } from '@/auth/guards/require-db-user.guard';
import {
  Body,
  Controller,
  Get,
  Param,
  Headers,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InstructorSchoolsService } from './instructor-schools.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { SchoolRolesGuard } from '@/auth/guards/school-roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';

@Controller('school-admin')
@UseGuards(ClerkAuthGuard, RequireDbUserGuard, SchoolRolesGuard)
@Roles('owner', 'admin')
export class SchoolAdminController {
  constructor(private readonly service: InstructorSchoolsService) {}

  @Get('instructors/:schoolId')
  async getInstructors(
    @Param('schoolId', new ParseUUIDPipe({ version: '4' })) schoolId: string,
  ) {
    return this.service.getSchoolInstructors(schoolId);
  }

  @Get('instructors/profile/:id')
  async getInstructorProfile(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Headers('x-school-id') schoolId: string,
  ) {
    return this.service.getInstructorProfile(schoolId, id);
  }

  @Get('requests/:schoolId')
  async getRequests(
    @Param('schoolId', new ParseUUIDPipe({ version: '4' })) schoolId: string,
  ) {
    return this.service.findSchoolRequests(schoolId);
  }

  @Patch('requests/:id/approve')
  async approve(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.service.updateRequestStatus(id, 'accepted');
  }

  @Patch('requests/:id/decline')
  async decline(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.service.updateRequestStatus(id, 'rejected');
  }

  @Post('invites')
  async sendInvite(
    @Headers('x-school-id') schoolId: string,
    @Body() dto: CreateInviteDto,
  ) {
    return this.service.createSchoolInvite(
      schoolId,
      dto.email,
      dto.name,
      dto.message,
    );
  }
}
