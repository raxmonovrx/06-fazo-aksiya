import { Global, Module } from '@nestjs/common';

import { ParticipantsService } from './participants.service.js';

@Global()
@Module({
  providers: [ParticipantsService],
  exports: [ParticipantsService],
})
export class ParticipantsModule {}
