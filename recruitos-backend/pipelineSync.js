// Moves a candidate's application forward on the Hiring Pipeline board when
// they clear a stage elsewhere in the app (Aptitude Test, GD, Interview).
// Only moves the application if it is currently sitting in `fromStage` —
// this prevents accidentally yanking a candidate who was already moved
// manually (e.g. rejected, or fast-tracked) back into the automated flow.
async function moveApplicationStage(supabase, { candidateId, jobId, fromStage, toStage }) {
  if (!candidateId) return null;

  let query = supabase
    .from('applications')
    .select('id, stage, job_id')
    .eq('candidate_id', candidateId)
    .eq('stage', fromStage);

  if (jobId) {
    query = query.eq('job_id', jobId);
  }

  const { data: apps, error } = await query;
  if (error || !apps || apps.length === 0) return null;

  // Multi-job safety guard: If jobId was not provided and candidate has more than 1
  // application in fromStage, advancing all of them would cross company boundaries!
  // If there is exactly 1 application in fromStage, it is safe to advance.
  if (!jobId && apps.length > 1) {
    console.warn(`pipelineSync: candidate ${candidateId} has ${apps.length} applications in stage ${fromStage}, but no jobId was provided. Refusing to bulk-advance across jobs.`);
    return null;
  }

  const { data, error: updateErr } = await supabase
    .from('applications')
    .update({ stage: toStage })
    .in('id', apps.map((a) => a.id))
    .select();

  if (updateErr) {
    console.error('pipelineSync: failed to move application stage', updateErr);
    return null;
  }

  console.log(`pipelineSync: moved ${data.length} application(s) for candidate ${candidateId}: ${fromStage} → ${toStage}`);
  return data;
}

module.exports = { moveApplicationStage };
