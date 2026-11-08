import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export function createSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('SweetHome API')
    .setDescription('REST API cho hệ thống quản lý và đặt phòng homestay SweetHome.')
    .setVersion('2.0.0')
    .addTag('Homestay & Rooms', 'Quản lý thông tin Homestay, Loại phòng, Phòng và Tiện nghi')
    .addTag('Booking', 'Tìm kiếm phòng trống, Đặt phòng trực tuyến và Thanh toán cọc')
    .addTag('Stay Operations', 'Vận hành lưu trú: Check-in, Dọn phòng và Ghi nhận dịch vụ')
    .addTag('Billing & Payment', 'Quyết toán hóa đơn, Thanh toán trả phòng và Xuất biên lai PDF')
    .addTag('Reviews', 'Đánh giá trải nghiệm và Phản hồi từ Host')
    .addTag('Reports & Admin', 'Báo cáo doanh thu, Tỷ lệ lấp đầy và Quản trị tài khoản')
    .addTag('Auth', 'Xác thực và Phân quyền JWT')
    .addTag('Health', 'Kiểm tra trạng thái Backend và Database')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'bearer',
    )
    .build();

  return SwaggerModule.createDocument(app, config);
}
