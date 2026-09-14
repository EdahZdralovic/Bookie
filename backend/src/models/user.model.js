function toPublicUser(user) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    name: `${user.firstName} ${user.lastName}`,
    email: user.email,
    role: user.role,
    city: user.city ? { id: user.city.id, name: user.city.name } : null,
  };
}

module.exports = { toPublicUser };
