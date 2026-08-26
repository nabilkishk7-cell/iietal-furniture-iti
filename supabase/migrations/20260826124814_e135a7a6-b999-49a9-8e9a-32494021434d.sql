revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.movement_valid() from public, anon, authenticated;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;