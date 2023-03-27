import { Injectable, UnauthorizedException } from '@nestjs/common';
import { User } from '../users/schemas/users.schema';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { LoginResponseDto } from './dto/login-response.dto';
import { EventLogService } from '../event-log/event-log.service';
import { EventLogTypeKey } from '../event-log/enums/event-log-type-key';
import { ApiException } from '../shared/exceptions/api-exception';
import { randomBytes } from 'crypto';
import { errorMessages } from '../shared/exceptions/error-messages';
import { HOSTNAME_TEST } from '../constants/constants.provider';
import { ethers } from 'ethers';

@Injectable()
/**
 * Authenticate users using their Ethereum signature.
 */
export class EthSignatureService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly eventLogService: EventLogService,
  ) {}

  /**
   * Generates a nonce for the user and returns it.
   *
   * @param identityEthAddress Ethereum address of the user
   * @returns User with updated nonce
   */
  async generateUserNonce(identityEthAddress: string): Promise<User> {
    // Generate random nonce used for auth request
    const nonce = randomBytes(10).toString('hex');

    try {
      // Find user by their Ethereum address, update nonce
      const user = await this.usersService.findOneByEth(identityEthAddress);
      return this.usersService.update(user._id, { nonce });
    } catch (e) {
      // No user found, create a new user
      return this.usersService.create({
        identityEthAddress,
        rewardsEthAddress: identityEthAddress,
        username: await this.usersService.generateValidUsername(
          identityEthAddress,
        ),
        nonce,
      });
    }
  }

  /**
   * Generates a login message that will be signed by the frontend user, and validated by the API.
   *
   * @param account Ethereum address of the user
   * @param nonce Random nonce used for authentication
   * @returns string Login message
   */
  generateLoginMessage(account: string, nonce: string): string {
    return (
      'SIGN THIS MESSAGE TO LOGIN TO PRAISE.\n\n' +
      `ADDRESS:\n${account}\n\n` +
      `NONCE:\n${nonce}`
    );
  }

  /**
   * Logs in the user and returns a JWT token.
   *
   * @param user User object with information about the user
   * @returns LoginResponse
   */
  async login(
    identityEthAddress: string,
    signature: string,
    hostname: string,
  ): Promise<LoginResponseDto> {
    let user;
    try {
      user = await this.usersService.findOneByEth(identityEthAddress);
    } catch (e) {
      // Throw UnauthorizedException instead of BadRequestException since
      // the user is not authenticated yet Nest.js defaults to that on
      // other authentication strategt errors
      throw new ApiException(errorMessages.UNAUTHORIZED);
    }

    // Check if user has previously generated a nonce
    if (!user.nonce) {
      throw new ApiException(errorMessages.NONCE_NOT_FOUND);
    }

    // Generate expected message
    const message = this.generateLoginMessage(identityEthAddress, user.nonce);

    // Verify signature
    try {
      // Recovered signer address must match identityEthAddress
      const signerAddress = ethers.utils.verifyMessage(message, signature);
      if (signerAddress !== identityEthAddress) throw new Error();
    } catch (e) {
      throw new UnauthorizedException('Signature verification failed');
    }

    const { roles } = user;

    // Create payload for the JWT token
    const payload: JwtPayload = {
      userId: user._id.toString(),
      identityEthAddress,
      roles,
      hostname: process.env.NODE_ENV === 'testing' ? HOSTNAME_TEST : hostname,
    } as JwtPayload;

    // Sign payload to create access token
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
      secret: process.env.JWT_SECRET,
    });

    await this.eventLogService.logEvent({
      typeKey: EventLogTypeKey.AUTHENTICATION,
      description: 'Logged in',
    });

    // Return login response with access token
    return {
      accessToken,
      identityEthAddress,
      tokenType: 'Bearer',
    };
  }
}