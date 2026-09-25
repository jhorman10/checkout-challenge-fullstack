export const mockPool = {
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
};

// Regular function (not arrow) so `new Pool()` returns mockPool correctly
export const Pool = vi.fn(function () { return mockPool; });