import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ExecuteCommandDto } from './execute-command.dto';

describe('ExecuteCommandDto', () => {
  it('should fail validation when command is missing', async () => {
    const dto = plainToInstance(ExecuteCommandDto, {
      rconPort: '25575',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === 'command')).toBe(true);
  });

  it('should fail validation when rconPort is invalid', async () => {
    const dto = plainToInstance(ExecuteCommandDto, {
      command: 'say hello',
      rconPort: 'abc',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === 'rconPort')).toBe(true);
  });
});
