import { Module } from '@nestjs/common';
import { ReviewController } from './review.controller';
import { ReviewsService } from './reviews.service';

@Module({
  controllers: [ReviewController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
