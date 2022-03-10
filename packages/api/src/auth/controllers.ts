import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from '@error/errors';
import {
  Query,
  TypedRequestBody,
  TypedRequestQuery,
  TypedResponse,
} from '@shared/types';
import { UserModel } from '@user/entities';
import { UserDocument } from '@user/types';
import { ethers } from 'ethers';
import randomstring from 'randomstring';
import { JwtService, JwtSet } from './JwtService';
import {
  AuthRequestInput,
  AuthResponse,
  NonceRequestInput,
  NonceResponse,
  RefreshRequestInput,
} from './types';

const jwtService = new JwtService();

const generateLoginMessage = (account: string, nonce: string): string => {
  return (
    'SIGN THIS MESSAGE TO LOGIN TO PRAISE.\n\n' +
    `ADDRESS:\n${account}\n\n` +
    `NONCE:\n${nonce}`
  );
};

/**
 * Description
 * @param
 */
export const auth = async (
  req: TypedRequestBody<AuthRequestInput>,
  res: TypedResponse<AuthResponse>
): Promise<void> => {
  const { ethereumAddress, signature } = req.body;
  if (!ethereumAddress) throw new NotFoundError('ethereumAddress');
  if (!signature) throw new NotFoundError('signature');

  // Find previously generated nonce
  const user = (await UserModel.findOne({ ethereumAddress })
    .select('nonce roles')
    .exec()) as UserDocument;
  if (!user || !user._id) throw new NotFoundError('User');
  if (!user.nonce)
    throw new BadRequestError('Noce not found. Call /api/nonce first.');

  // Generate expected message, nonce included.
  // Recover signer from generated message + signature
  const generatedMsg = generateLoginMessage(ethereumAddress, user.nonce);
  const signerAddress = ethers.utils.verifyMessage(generatedMsg, signature);
  if (signerAddress !== ethereumAddress)
    throw new UnauthorizedError('Verification failed.');

  const { accessToken, refreshToken }: JwtSet = jwtService.getJwt({
    userId: user._id,
    ethereumAddress,
    roles: user.roles,
  });
  user.accessToken = accessToken;
  user.refreshToken = refreshToken;
  await user.save();

  res.status(200).json({
    accessToken,
    refreshToken,
    ethereumAddress,
    tokenType: 'Bearer',
  });
};

interface NonceRequestInputParsedQs extends Query, NonceRequestInput {}

/**
 * Description
 * @param
 */
export const nonce = async (
  req: TypedRequestQuery<NonceRequestInputParsedQs>,
  res: TypedResponse<NonceResponse>
): Promise<void> => {
  const { ethereumAddress } = req.query;
  if (!ethereumAddress) throw new NotFoundError('ethereumAddress');

  // Generate random nonce used for auth request
  const nonce = randomstring.generate();

  // Update existing user or create new
  await UserModel.findOneAndUpdate(
    { ethereumAddress },
    { nonce },
    { upsert: true, new: true }
  );

  res.status(200).json({
    ethereumAddress,
    nonce,
  });
};

/**
 * Description
 * @param
 */
export const refresh = async (
  req: TypedRequestBody<RefreshRequestInput>,
  res: TypedResponse<AuthResponse>
): Promise<void> => {
  // confirm refreshToken matches a single user.refreshToken
  const { refreshToken } = req.body;

  const user = await UserModel.findOne({ refreshToken });
  if (!user || !user._id || !user.ethereumAddress)
    throw new NotFoundError('User');

  // confirm refreshToken provided is valid
  const jwt: JwtSet = jwtService.refreshJwt(refreshToken);

  // update user tokens
  user.accessToken = jwt.accessToken;
  user.refreshToken = jwt.refreshToken;
  await user.save();

  // return updated tokens
  res.status(200).json({
    accessToken: jwt.accessToken,
    refreshToken: jwt.refreshToken,
    ethereumAddress: user.ethereumAddress,
    tokenType: 'Bearer',
  });
};
