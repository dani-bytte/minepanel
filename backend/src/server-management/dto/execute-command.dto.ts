import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ExecuteCommandDto {
  @IsString()
  @MinLength(1, { message: 'command is required' })
  @MaxLength(1024, { message: 'command must be at most 1024 characters' })
  command: string;

  @IsString()
  @Matches(/^\d{1,5}$/, { message: 'rconPort must be a valid port number' })
  rconPort: string;

  @IsOptional()
  @IsString()
  @MaxLength(256, { message: 'rconPassword must be at most 256 characters' })
  rconPassword?: string;
}
