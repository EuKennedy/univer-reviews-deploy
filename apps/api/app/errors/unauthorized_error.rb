class UnauthorizedError < StandardError
  def initialize(msg = "Unauthorized")
    super
  end
end
