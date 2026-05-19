class ProcessPlatformEventJob < ApplicationJob
  queue_as :default

  def perform(event_id)
    event = PlatformEvent.find_by(id: event_id)
    return unless event
    return if event.processed?

    with_workspace_rls(event.workspace_id) do
      PlatformEvents::Processor.process(event)
      event.mark_processed!
    end
  end
end
