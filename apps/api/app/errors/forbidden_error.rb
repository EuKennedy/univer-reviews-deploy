class ForbiddenError < StandardError
  def initialize(msg = "Forbidden")
    super
  end
end
