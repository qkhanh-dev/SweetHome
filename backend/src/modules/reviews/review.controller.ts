import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  CurrentAccount,
  CurrentAccountData,
} from '../../common/decorators/current-account.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { result } from '../../common/utils/sh07-result';
import { CreateReviewDto, QueryReviewDto, ReplyReviewDto } from './dto/review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Reviews - SD06')
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiQuery({ name: 'maPhong', required: false, type: String })
  @ApiQuery({ name: 'maLoaiPhong', required: false, type: String })
  @ApiQuery({ name: 'soSao', required: false, type: Number })
  async list(@Query() query: QueryReviewDto) {
    return result('Lấy danh sách đánh giá thành công', await this.reviewsService.list(query));
  }

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  async create(@Body() dto: CreateReviewDto, @CurrentAccount() user?: CurrentAccountData | null) {
    return result(
      'Cảm ơn bạn đã gửi đánh giá trải nghiệm tại SweetHome',
      await this.reviewsService.create(dto, user),
    );
  }

  @Patch(':id/reply')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async reply(@Param('id') id: string, @Body() dto: ReplyReviewDto) {
    return result('Phản hồi đánh giá thành công', await this.reviewsService.reply(id, dto));
  }
}
