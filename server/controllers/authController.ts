import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { AppError, repository } from '../db/repository.ts';
import { signAuthToken, type AuthenticatedRequest } from '../middleware/auth.ts';

function handleControllerError(res: Response, err: unknown): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error('Auth error:', err);
  res.status(500).json({ error: 'Internal server error.' });
}

export async function getAuthStatus(_req: Request, res: Response): Promise<void> {
  try {
    const count = await repository.getUserCount();
    res.json({ needsSetup: count === 0 });
  } catch (err) {
    handleControllerError(res, err);
  }
}

export async function setupFirstAdmin(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password } = req.body as {
      name: string;
      email: string;
      password: string;
    };
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await repository.createUser({
      name,
      email,
      passwordHash,
      role: 'admin',
      requireEmptyUsers: true,
    });
    const token = signAuthToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    res.status(201).json({ token, user });
  } catch (err) {
    handleControllerError(res, err);
  }
}

export async function registerStaff(req: Request, res: Response): Promise<void> {
  try {
    const userCount = await repository.getUserCount();
    if (userCount === 0) {
      res.status(403).json({
        error: 'Initial administrator setup must be completed before staff registration.',
      });
      return;
    }
    const { name, email, password } = req.body as {
      name: string;
      email: string;
      password: string;
    };
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await repository.createUser({
      name,
      email,
      passwordHash,
      role: 'staff',
    });
    const token = signAuthToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    res.status(201).json({ token, user });
  } catch (err) {
    handleControllerError(res, err);
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const record = await repository.findUserByEmail(email);
    if (!record) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    if (!record.active) {
      res.status(403).json({ error: 'This account has been deactivated by an administrator.' });
      return;
    }
    const valid = await bcrypt.compare(password, record.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const user = {
      id: record.id,
      name: record.name,
      email: record.email,
      role: record.role,
      active: record.active,
      avatarUrl: record.avatarUrl,
      createdAt: record.createdAt,
    };
    const token = signAuthToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    res.json({ token, user });
  } catch (err) {
    handleControllerError(res, err);
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const record = await repository.findUserById(req.user!.id);
    if (!record) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json({
      id: record.id,
      name: record.name,
      email: record.email,
      role: record.role,
      active: record.active,
      avatarUrl: record.avatarUrl,
      createdAt: record.createdAt,
    });
  } catch (err) {
    handleControllerError(res, err);
  }
}

export async function updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, email } = req.body as { name?: string; email?: string };
    const user = await repository.updateUser(req.user!.id, { name, email });
    const token = signAuthToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    res.json({ user, token });
  } catch (err) {
    handleControllerError(res, err);
  }
}

export async function changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };
    const record = await repository.findUserById(req.user!.id);
    if (!record) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const valid = await bcrypt.compare(currentPassword, record.passwordHash);
    if (!valid) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await repository.updateUser(req.user!.id, { passwordHash });
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    handleControllerError(res, err);
  }
}

export async function listUsers(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const users = await repository.listUsers();
    res.json(users);
  } catch (err) {
    handleControllerError(res, err);
  }
}

export async function createUserByAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, email, password, role } = req.body as {
      name: string;
      email: string;
      password: string;
      role: 'admin' | 'staff';
    };
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await repository.createUser({
      name,
      email,
      passwordHash,
      role,
    });
    res.status(201).json(user);
  } catch (err) {
    handleControllerError(res, err);
  }
}

export async function updateUserByAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, role, active } = req.body as {
      name?: string;
      role?: 'admin' | 'staff';
      active?: boolean;
    };
    if (id === req.user!.id && active === false) {
      res.status(400).json({ error: 'You cannot deactivate your own active session.' });
      return;
    }
    if (id === req.user!.id && role && role !== 'admin') {
      res.status(400).json({ error: 'You cannot demote your own administrator role.' });
      return;
    }
    const user = await repository.updateUser(id, { name, role, active });
    res.json(user);
  } catch (err) {
    handleControllerError(res, err);
  }
}

export async function deleteUserByAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await repository.deleteUser(req.params.id, req.user!.id);
    res.json({ message: 'User removed.' });
  } catch (err) {
    handleControllerError(res, err);
  }
}
