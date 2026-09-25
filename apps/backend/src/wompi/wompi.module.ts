import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WompiService } from './wompi.service.js';
import { WompiClient } from './wompi.client.js';

@Module({
  imports: [ConfigModule],
  providers: [WompiClient, WompiService],
  exports: [WompiClient, WompiService],
})
export class WompiModule {}