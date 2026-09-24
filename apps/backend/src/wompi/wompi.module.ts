import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WompiService } from './wompi.service.js';

@Module({
  imports: [HttpModule.register({ timeout: 10000, maxContentLength: 10485760 })],
  providers: [WompiService],
  exports: [WompiService],
})
export class WompiModule {}
